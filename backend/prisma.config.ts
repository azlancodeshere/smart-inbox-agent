import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// This app owns the shared schema: backend/prisma/schema.prisma (+ migrations).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
