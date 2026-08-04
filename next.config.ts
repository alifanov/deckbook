import type { NextConfig } from "next";

// ponytail: 'unsafe-inline' вместо nonce — Next инлайнит бутстрап-скрипты и стили,
// а страницы сплошь на style={{…}}; nonce требует прокидывания через middleware.
// Апгрейд до nonce — когда появится реальный XSS-вектор в пользовательском вводе.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // картинки в markdown-документах бывают внешние
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

/** HSTS включаем только на домене с валидным сертификатом — иначе браузер запомнит битый https. */
const hsts = process.env.ENABLE_HSTS === "1";

export const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ...(hsts
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const config: NextConfig = {
  // ponytail: проект на TypeScript 7 — сборке нужен его CLI, а не старое API компилятора
  experimental: { useTypeScriptCli: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
