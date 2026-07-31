import { NextResponse, type NextRequest } from "next/server";
import { sessionEpoch } from "./auth";
import { SESSION_COOKIE, isValidSession } from "./session";

/** Всё, кроме входа и MCP, живёт под сессией владельца. */
export async function middleware(request: NextRequest) {
  const epoch = await sessionEpoch();
  if (epoch !== null && isValidSession(request.cookies.get(SESSION_COOKIE)?.value, epoch)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!login|api/session|mcp|_next|favicon.ico).*)"],
};
