import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import {
  generateAccessAndRefreshTokens,
  refreshTokenMatches,
  tokenCookieOptions,
  verifyRefreshToken,
} from "../lib/tokens";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * REGISTER — POST /api/register
 * Body: { name, email, password }
 * (Logic ported 1:1 from the old Next.js /api/signup route.)
 */
router.post("/register", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, password: hashed } });

    return res.status(201).json({ ok: true, userId: user.id });
  } catch (err) {
    // Race: two requests can both pass the `findUnique` check above; the DB's
    // unique index on `email` then rejects the second insert (P2002).
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

/**
 * LOGIN — POST /api/login
 * Body: { email, password }
 * Returns the user on success (no session token here — Auth.js still mints
 * the session cookie; this endpoint is the credentials check itself).
 */
router.post("/login", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Issue the access + refresh token pair (also set as httpOnly cookies).
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id);

    return res
      .cookie("accessToken", accessToken, tokenCookieOptions)
      .cookie("refreshToken", refreshToken, tokenCookieOptions)
      .json({
        ok: true,
        user: { id: user.id, name: user.name, email: user.email },
        accessToken, // also in the body, for non-browser clients
        refreshToken,
      });
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode) {
      return res.status(statusCode).json({ error: (err as Error).message });
    }
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

/**
 * REFRESH — POST /api/refresh
 * Body or cookie: { refreshToken }
 *
 * Verifies the JWT, then checks it against the refresh token stored on the
 * user row — a mismatch (already rotated / stolen) is a 401. On success a
 * NEW pair is issued and the old refresh token dies (rotation).
 */
router.post("/refresh", async (req, res) => {
  try {
    const incoming = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incoming || typeof incoming !== "string") {
      return res.status(401).json({ error: "Refresh token is required" });
    }

    const decoded = verifyRefreshToken(incoming);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    if (!user.refreshToken || !refreshTokenMatches(incoming, user.refreshToken)) {
      return res.status(401).json({ error: "Refresh token is expired or invalid" });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id);

    return res
      .cookie("accessToken", accessToken, tokenCookieOptions)
      .cookie("refreshToken", refreshToken, tokenCookieOptions)
      .json({ ok: true, accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

/**
 * LOGOUT — POST /api/logout
 * Clears both cookies AND nulls the stored refresh token server-side, so a
 * copy of the token taken before logout stops working too.
 */
router.post("/logout", async (req, res) => {
  try {
    const incoming = req.cookies?.refreshToken;
    if (typeof incoming === "string") {
      const decoded = verifyRefreshToken(incoming);
      if (decoded) {
        await prisma.user.updateMany({
          where: { id: decoded.id },
          data: { refreshToken: null },
        });
      }
    }
  } catch (err) {
    console.error(err); // best-effort — the cookies are cleared either way
  }

  return res
    .clearCookie("accessToken", tokenCookieOptions)
    .clearCookie("refreshToken", tokenCookieOptions)
    .json({ ok: true });
});

export default router;
