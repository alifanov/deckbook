import { expect, test } from "vitest";
import { securityHeaders } from "../next.config";

const header = (key: string) => securityHeaders.find((h) => h.key === key)?.value;

test("выставлены обязательные security-заголовки", () => {
  expect(header("X-Frame-Options")).toBe("DENY");
  expect(header("X-Content-Type-Options")).toBe("nosniff");
  expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
});

test("CSP запрещает вложение в iframe и чужие источники по умолчанию", () => {
  const csp = header("Content-Security-Policy") ?? "";
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  // в тестовом (не dev) окружении eval не разрешаем
  expect(csp).not.toContain("'unsafe-eval'");
});

test("HSTS выключен, пока не выставлен ENABLE_HSTS", () => {
  expect(header("Strict-Transport-Security")).toBeUndefined();
});
