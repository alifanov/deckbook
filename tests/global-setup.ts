import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/** Ключ advisory-локи: один на все прогоны тестов против одной базы. */
export const TEST_LOCK_KEY = 872364501;

let client: PrismaClient | undefined;

// ponytail: прогоны из разных чекаутов делят одну тестовую базу, а каждый тест
// начинается с TRUNCATE — без локи параллельные прогоны вытирают данные друг
// у друга. Лока живёт в сессии Postgres, поэтому пул держим на одном
// соединении, которое никогда не закрывается по простою.
export async function setup() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // переменные уже в окружении
  }
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("TEST_DATABASE_URL не задан — тестам некуда ходить");

  client = new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 1, idleTimeoutMillis: 0 }),
  });
  // pg_advisory_lock возвращает void, а его Prisma разобрать не умеет — отсюда IS NULL.
  await client.$queryRawUnsafe(`SELECT pg_advisory_lock(${TEST_LOCK_KEY}) IS NULL AS locked`);
}

export async function teardown() {
  await client?.$disconnect();
}
