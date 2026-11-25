import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import prisma from "./lib/prisma";
import profileRouter from "./routes/profile";
import authRouter from "./routes/auth";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "assign-backend" });
});

app.use("/api", authRouter);
app.use("/api", profileRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {

if (err instanceof SyntaxError || (err as { type?: string }).type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  console.error(err);
  res.status(500).json({ error: "Server error" });
};
app.use(errorHandler);

app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log("✔ Database connected");
  } catch (err) {
    console.error("✖ Database connection failed:", err);
    process.exit(1);
  }
  console.log(`✔ API listening on http://localhost:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  });
}
