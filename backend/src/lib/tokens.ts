import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";
import prisma from "./prisma";

/**
 * Access / refresh token pair — the classic pattern:
 *
 *   generateAccessToken(user)          short-lived JWT (identity claims)
 *   generateRefreshToken(user)         long-lived JWT (id only)
 *   generateAccessAndRefreshTokens(id) mints both + persists the refresh
 *                                     token on the user row (rotation)
 *   verifyAccessToken / verifyRefreshToken   safe helpers (null on failure)
 *
 * Two DIFFERENT secrets: stealing the access token gains nothing after its
 * 15 minutes, and a refresh token only works while it matches the DB row.
 */

export type AccessTokenPayload = {
  id: string;
  email?: string | null;
  name?: string | null;
  iat?: number;
  exp?: number;
};

type TokenUser = { id: string; email?: string | null; name?: string | null };

function secret(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} — add it to backend/.env`);
  return value;
}

// ms.StringValue is a literal union ("15m" | "7d" | …), so a plain string
// coming from .env needs a cast.
function expiresIn(name: string, fallback: string): jwt.SignOptions["expiresIn"] {
  return (process.env[name] ?? fallback) as unknown as jwt.SignOptions["expiresIn"];
}

/** userSchema.methods.generateAccessToken — identity + lookup claims, short-lived. */
export function generateAccessToken(user: TokenUser): string {
  return jwt.sign(
    { id: user.id, email: user.email ?? null, name: user.name ?? null },
    secret("ACCESS_TOKEN_SECRET"),
    { expiresIn: expiresIn("ACCESS_TOKEN_EXPIRY", "15m") },
  );
}

/** userSchema.methods.generateRefreshToken — id only, long-lived. */
export function generateRefreshToken(user: TokenUser): string {
  return jwt.sign(
    { id: user.id },
    secret("REFRESH_TOKEN_SECRET"),
    { expiresIn: expiresIn("REFRESH_TOKEN_EXPIRY", "7d") },
  );
}

/**
 * generateAccessAndRefreshTokens(userId) — mints both tokens and stores the
 * refresh token on the user row. Storing it means the PREVIOUS refresh token
 * stops working the moment a new one is issued (rotation).
 */
export async function generateAccessAndRefreshTokens(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken },
  });

  return { accessToken, refreshToken };
}

/** Returns the payload, or null when the token is invalid/expired/wrong secret. */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, secret("ACCESS_TOKEN_SECRET"));
    if (typeof payload === "string" || typeof payload.id !== "string") return null;
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

/** Same idea for the refresh token — returns the id or null. */
export function verifyRefreshToken(token: string): { id: string } | null {
  try {
    const payload = jwt.verify(token, secret("REFRESH_TOKEN_SECRET"));
    if (typeof payload === "string" || typeof payload.id !== "string") return null;
    return { id: payload.id };
  } catch {
    return null;
  }
}

/** Refresh tokens are secrets — compare them in constant time. */
export function refreshTokenMatches(incoming: string, stored: string): boolean {
  const a = Buffer.from(incoming);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Shared cookie flags for setting AND clearing the pair.
 * `path: "/api"` keeps the tokens away from page loads — only API calls
 * receive them (cookies ignore ports, so localhost:3000 and :4000 share them).
 */
export const tokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api",
};
