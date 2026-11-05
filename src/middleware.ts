import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Allow static assets, health check, and auth endpoints to pass freely
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. If the URL contains a bootstrap token (?token=...), allow it through to AuthGate for redemption
  if (searchParams.has("token")) {
    return NextResponse.next();
  }

  // 3. For protected portal routes, check for the presence of the session cookie
  const sessionCookie = request.cookies.get("mc_payroll_session");

  // If no session cookie and no token, redirect to entry state
  if (!sessionCookie && (pathname.startsWith("/admin") || pathname.startsWith("/dash"))) {
    // Return early to let AuthGate render the unauthenticated / token required screen
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
