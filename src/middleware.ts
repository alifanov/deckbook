import { NextResponse, type NextRequest } from "next/server";
import { sessionEpoch } from "./auth";
import { ISSUED_COOKIE, ISSUED_HEADER } from "./domain/tokens";
import { SESSION_COOKIE, isValidSession } from "./session";

/** Всё, кроме входа и MCP, живёт под сессией владельца. */
export async function middleware(request: NextRequest) {
  const epoch = await sessionEpoch();
  if (epoch === null || !isValidSession(request.cookies.get(SESSION_COOKIE)?.value, epoch)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // выпущенный токен отдаём странице заголовком и тут же гасим куку —
  // «показывается один раз» должно означать именно один раз
  const issued = request.cookies.get(ISSUED_COOKIE)?.value;
  if (!issued) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set(ISSUED_HEADER, issued);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.delete(ISSUED_COOKIE);
  return response;
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!login|api/session|mcp|_next|favicon.ico).*)"],
};
