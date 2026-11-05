import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow static assets, health check, login, and auth endpoints to pass freely
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/login") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. For protected portal routes, check for the presence of the session cookie
  const sessionCookie = request.cookies.get("mc_payroll_session");

  // If no session cookie on protected routes, redirect directly to /payrol/login
  if (!sessionCookie && (pathname.startsWith("/admin") || pathname.startsWith("/dash"))) {
    return NextResponse.redirect(new URL("/payrol/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
