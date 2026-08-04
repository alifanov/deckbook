import { expect, test } from "vitest";
import { prisma } from "../src/db";
import { TEST_LOCK_KEY } from "./global-setup";

test("прогон держит advisory-локу на общей тестовой базе", async () => {
  const rows = await prisma.$queryRawUnsafe<{ granted: boolean }[]>(
    `SELECT granted FROM pg_locks WHERE locktype = 'advisory' AND objid = ${TEST_LOCK_KEY}`,
  );
  expect(rows.some((row) => row.granted)).toBe(true);
});
