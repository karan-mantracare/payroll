import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow static assets, chunks, health check, login, and public media to pass without interception
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/payrol/_next") ||
    pathname.includes("/_next/") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/payrol/login") ||
    /\.(js|css|png|jpg|jpeg|gif|ico|svg|json|map|woff|woff2|ttf|eot)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("mc_payroll_session");

  // 2. Unauthenticated root navigation redirects immediately to /payrol/login
  if ((pathname === "/" || pathname === "/payrol" || pathname === "") && !sessionCookie) {
    return NextResponse.redirect(new URL("/payrol/login", request.url));
  }

  // 3. For protected portal routes, check for the presence of the session cookie
  if (!sessionCookie && (pathname.startsWith("/admin") || pathname.startsWith("/dash"))) {
    return NextResponse.redirect(new URL("/payrol/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|payrol/_next/static|payrol/_next/image|favicon.ico|favicon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)).*)",
  ],
};
