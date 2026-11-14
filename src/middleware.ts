import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow static assets, chunks, health check, login, and public media to pass without interception
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/payroll/_next") ||
    pathname.includes("/_next/") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/payroll/login") ||
    /\.(js|css|png|jpg|jpeg|gif|ico|svg|json|map|woff|woff2|ttf|eot)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("mc_payroll_session");

  // Helper function to resolve host & protocol behind reverse proxies (e.g. Docker 0.0.0.0:80)
  const getRedirectUrl = (targetPath: string): URL => {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost || request.headers.get("host");
    const proto =
      request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");

    if (host && !host.startsWith("0.0.0.0")) {
      return new URL(targetPath, `${proto}://${host}`);
    }
    return new URL(targetPath, request.url);
  };

  // 2. Unauthenticated root navigation redirects immediately to /payroll/login
  if ((pathname === "/" || pathname === "/payroll" || pathname === "") && !sessionCookie) {
    return NextResponse.redirect(getRedirectUrl("/payroll/login"));
  }

  // 3. For protected portal routes, check for the presence of the session cookie
  if (!sessionCookie && (pathname.startsWith("/admin") || pathname.startsWith("/dash"))) {
    return NextResponse.redirect(getRedirectUrl("/payroll/login"));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|payroll/_next/static|payroll/_next/image|favicon.ico|favicon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)).*)",
  ],
};
