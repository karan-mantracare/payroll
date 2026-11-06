import { NextRequest, NextResponse } from "next/server";
import { verifyLoginOtp } from "@/lib/auth/direct";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { challengeToken, otp } = body;

    if (!challengeToken || !otp) {
      return NextResponse.json(
        { success: false, error: "Challenge token and verification code are required." },
        { status: 400 }
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const result = await verifyLoginOtp({
      challengeToken,
      otp,
      ipAddress,
      userAgent,
    });

    if (!result.success || !result.sessionId) {
      const status =
        result.code === "MAX_ATTEMPTS_EXCEEDED"
          ? 429
          : result.code === "PORTAL_ACCESS_DENIED"
          ? 403
          : 401;

      return NextResponse.json(
        {
          success: false,
          code: result.code,
          error: result.error,
        },
        { status }
      );
    }

    const response = NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
      user: result.user,
    });

    const isProduction = process.env.NODE_ENV === "production";
    const maxAge = parseInt(process.env.SESSION_EXPIRY_SECONDS || "28800", 10);

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: result.sessionId,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/payrol",
      maxAge,
    });

    return response;
  } catch (err: any) {
    console.error("[Auth API] Verify OTP exception:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to verify login code at this time. Please try again.",
      },
      { status: 500 }
    );
  }
}

