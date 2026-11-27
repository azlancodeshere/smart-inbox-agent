import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import {
  generateAccessAndRefreshTokens,
  refreshTokenMatches,
  tokenCookieOptions,
  verifyRefreshToken,
} from "../lib/tokens";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

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

const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id);

    return res
      .cookie("accessToken", accessToken, tokenCookieOptions)
      .cookie("refreshToken", refreshToken, tokenCookieOptions)
      .json({
        ok: true,
        user: { id: user.id, name: user.name, email: user.email },
        accessToken, 
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
    console.error(err); 
  }

  return res
    .clearCookie("accessToken", tokenCookieOptions)
    .clearCookie("refreshToken", tokenCookieOptions)
    .json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    });

    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
