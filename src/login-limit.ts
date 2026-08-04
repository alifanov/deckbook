/**
 * Ограничитель перебора пароля на входе.
 *
 * ponytail: счётчик живёт в памяти процесса — рестарт его обнуляет, а при
 * нескольких инстансах у каждого свой. Против перебора с одного адреса этого
 * хватает; понадобится общий на все инстансы — переносить в базу.
 */

export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 15 * 60 * 1000;

/** Сколько ключей держим, прежде чем выбросить протухшие. */
const MAX_KEYS = 1000;

/** `until` — конец окна: и срок блокировки, и срок жизни самого счёта попыток. */
const attempts = new Map<string, { failures: number; until: number }>();

/** За прокси настоящий адрес приезжает заголовком; без него все в одной корзине. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function isLocked(key: string, now = Date.now()): boolean {
  const entry = attempts.get(key);
  return entry !== undefined && entry.failures >= MAX_ATTEMPTS && entry.until > now;
}

/** Неудачная попытка; на MAX_ATTEMPTS подряд вход закрывается на LOCK_MS. */
export function recordFailure(key: string, now = Date.now()): void {
  if (attempts.size >= MAX_KEYS) prune(now);

  const entry = attempts.get(key);
  // окно истекло — серия начинается заново
  const failures = entry && entry.until > now ? entry.failures + 1 : 1;
  attempts.set(key, { failures, until: now + LOCK_MS });
}

/** Успешный вход обнуляет счётчик. */
export function resetAttempts(key: string): void {
  attempts.delete(key);
}

function prune(now: number): void {
  for (const [key, entry] of attempts) {
    if (entry.until <= now) attempts.delete(key);
  }
}
