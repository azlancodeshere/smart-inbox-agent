import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import prisma from "../lib/prisma";

const router = Router();

router.get("/ping", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
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
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
