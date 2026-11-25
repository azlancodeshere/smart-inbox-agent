import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// The frontend has no prisma/ folder — it uses the schema owned by the backend.
export default defineConfig({
  schema: "../backend/prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
