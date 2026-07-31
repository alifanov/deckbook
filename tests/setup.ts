import { beforeEach } from "vitest";

try {
  process.loadEnvFile(".env");
} catch {
  // env vars already in the environment
}

// Домен тестируется против настоящего Postgres — но не против рабочей базы.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL не задан — тестам некуда ходить");
process.env.DATABASE_URL = testUrl;
process.env.SESSION_SECRET ??= "test-secret";
process.env.OWNER_PASSWORD ??= "test-password";

const { prisma } = await import("../src/db");

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Comment", "Task", "Document", "Token", "Project", "Owner" RESTART IDENTITY CASCADE',
  );
});
