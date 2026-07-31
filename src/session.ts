import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "deckbook_session";
export const SESSION_DAYS = 30;

/** Сравнение секретов за постоянное время. */
export const equal = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET не задан");
  return value;
}

/** Кука — это `срок:поколение`, подписанные ключом сессий. */
export function signSession(expiresAt: number, epoch: number): string {
  const payload = `${expiresAt}:${epoch}`;
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("hex")}`;
}

/**
 * Сессия жива, если подпись наша, срок не вышел и поколение совпадает
 * с текущим — выход поднимает поколение и обнуляет все выданные cookie.
 */
export function isValidSession(value: string | undefined, epoch: number): boolean {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;

  const [expiresAt, cookieEpoch] = payload.split(":");
  const expected = signSession(Number(expiresAt), Number(cookieEpoch)).split(".")[1];
  return (
    equal(expected, signature) && Number(expiresAt) > Date.now() && Number(cookieEpoch) === epoch
  );
}
