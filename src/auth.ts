import { randomBytes, scryptSync } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { SESSION_COOKIE, SESSION_DAYS, equal, isValidSession, signSession } from "./session";

function scrypt(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

/**
 * Пароль владельца приходит переменной окружения при первом запуске
 * и с этого момента живёт в базе только хешем.
 */
async function owner() {
  const existing = await prisma.owner.findFirst();
  if (existing) return existing;

  const password = process.env.OWNER_PASSWORD;
  if (!password) throw new Error("OWNER_PASSWORD не задан — войти невозможно");

  const salt = randomBytes(16).toString("hex");
  return prisma.owner.create({
    data: { id: 1, passwordHash: `${salt}:${scrypt(password, salt)}` },
  });
}

/** Текущее поколение сессий; до первого входа владельца его ещё нет. */
export async function sessionEpoch(): Promise<number | null> {
  return (await prisma.owner.findFirst())?.sessionEpoch ?? null;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const [salt, hash] = (await owner()).passwordHash.split(":");
  return equal(scrypt(password, salt), hash);
}

export async function startSession() {
  const { sessionEpoch: epoch } = await owner();
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  (await cookies()).set(SESSION_COOKIE, signSession(expires, epoch), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
}

/** Выход закрывает доступ везде, а не только в этом браузере. */
export async function endSession() {
  await prisma.owner.updateMany({ data: { sessionEpoch: { increment: 1 } } });
  (await cookies()).delete(SESSION_COOKIE);
}

export async function isSignedIn(): Promise<boolean> {
  const epoch = await sessionEpoch();
  if (epoch === null) return false;
  return isValidSession((await cookies()).get(SESSION_COOKIE)?.value, epoch);
}
