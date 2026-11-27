import { Router } from "express";

const router = Router();

router.get("/ping", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

export default router;
