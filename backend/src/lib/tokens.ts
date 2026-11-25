import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";
import prisma from "./prisma";

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

function expiresIn(name: string, fallback: string): jwt.SignOptions["expiresIn"] {
  return (process.env[name] ?? fallback) as unknown as jwt.SignOptions["expiresIn"];
}

export function generateAccessToken(user: TokenUser): string {
  return jwt.sign(
    { id: user.id, email: user.email ?? null, name: user.name ?? null },
    secret("ACCESS_TOKEN_SECRET"),
    { expiresIn: expiresIn("ACCESS_TOKEN_EXPIRY", "15m") },
  );
}

export function generateRefreshToken(user: TokenUser): string {
  return jwt.sign(
    { id: user.id },
    secret("REFRESH_TOKEN_SECRET"),
    { expiresIn: expiresIn("REFRESH_TOKEN_EXPIRY", "7d") },
  );
}

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

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, secret("ACCESS_TOKEN_SECRET"));
    if (typeof payload === "string" || typeof payload.id !== "string") return null;
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { id: string } | null {
  try {
    const payload = jwt.verify(token, secret("REFRESH_TOKEN_SECRET"));
    if (typeof payload === "string" || typeof payload.id !== "string") return null;
    return { id: payload.id };
  } catch {
    return null;
  }
}

export function refreshTokenMatches(incoming: string, stored: string): boolean {
  const a = Buffer.from(incoming);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const tokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api",
};
