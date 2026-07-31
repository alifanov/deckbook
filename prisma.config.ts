import { defineConfig } from "prisma/config";

// ponytail: Prisma 7 no longer auto-loads .env — node's stdlib loader does it.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env — env vars come from the environment (docker compose)
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
