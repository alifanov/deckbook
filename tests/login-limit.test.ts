import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOCK_MS,
  MAX_ATTEMPTS,
  clientKey,
  isLocked,
  recordFailure,
  resetAttempts,
} from "../src/login-limit";

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: () => {}, delete: () => {}, get: () => undefined }),
}));

const { POST } = await import("../src/app/api/session/route");

function login(password: string, ip: string) {
  const form = new FormData();
  form.append("password", password);
  return POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      body: form,
      headers: { "x-forwarded-for": ip },
    }),
  );
}

const errorOf = (response: Response) =>
  decodeURIComponent(new URL(response.headers.get("location") ?? "", "http://localhost").search);

afterEach(() => vi.restoreAllMocks());

describe("счётчик неудачных попыток", () => {
  it("закрывает вход только на MAX_ATTEMPTS подряд", () => {
    const now = 1_000_000;
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      recordFailure("счёт", now);
      expect(isLocked("счёт", now)).toBe(false);
    }

    recordFailure("счёт", now);
    expect(isLocked("счёт", now)).toBe(true);
    expect(isLocked("счёт", now + LOCK_MS + 1)).toBe(false);
  });

  it("успешный вход обнуляет счёт", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) recordFailure("сброс", now);
    resetAttempts("сброс");

    recordFailure("сброс", now);
    expect(isLocked("сброс", now)).toBe(false);
  });

  it("считает адреса по отдельности", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailure("первый", now);

    expect(isLocked("первый", now)).toBe(true);
    expect(isLocked("второй", now)).toBe(false);
  });

  it("берёт адрес из заголовков прокси", () => {
    const key = (headers: Record<string, string>) =>
      clientKey(new Request("http://localhost/api/session", { headers }));

    expect(key({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })).toBe("203.0.113.7");
    expect(key({ "x-real-ip": "203.0.113.8" })).toBe("203.0.113.8");
    expect(key({})).toBe("unknown");
  });
});

describe("вход под перебором", () => {
  it("упирается в лимит, а после его снятия верный пароль проходит", async () => {
    const ip = "198.51.100.5";
    const start = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(errorOf(await login("не тот", ip))).toContain("Пароль не подошёл");
    }

    // правильный пароль в блокировке даже не проверяется
    expect(errorOf(await login(String(process.env.OWNER_PASSWORD), ip))).toContain("Слишком много");

    clock.mockReturnValue(start + LOCK_MS + 1);
    const response = await login(String(process.env.OWNER_PASSWORD), ip);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
  });
});
