import { NextRequest, NextResponse } from "next/server";
import { processProgramsHandshake } from "@/lib/auth/handshake";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = body.token;

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const result = await processProgramsHandshake(token, ipAddress, userAgent);

    if (!result.success || !result.sessionId) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
    }

    const response = NextResponse.json({
      authenticated: true,
      user: result.user,
    });

    // Set secure HttpOnly session cookie (enforce secure in production HTTPS)
    const isHttps = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: result.sessionId,
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/payrol",
      maxAge: parseInt(process.env.SESSION_EXPIRY_SECONDS || "28800", 10),
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal authentication handshake error", details: error.message },
      { status: 500 }
    );
  }
}

