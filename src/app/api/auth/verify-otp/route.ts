import { NextRequest, NextResponse } from "next/server";
import { verifyLoginOtp } from "@/lib/auth/direct";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { generateCorrelationId, logSecureError, sanitizeUserFacingError } from "@/lib/security/safe-logger";

export async function POST(req: NextRequest) {
  const correlationId = generateCorrelationId("api_verify");

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "Verification code and session are required.",
          correlationId,
        },
        { status: 400 }
      );
    }

    const { challengeToken, otp } = body;

    if (!challengeToken || !otp || typeof challengeToken !== "string" || typeof otp !== "string") {
      return NextResponse.json(
        {
          success: false,
          code: "MISSING_PARAMETERS",
          error: "Please enter the complete 6-digit verification code.",
          correlationId,
        },
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
          code: result.code || "VERIFY_FAILED",
          error: sanitizeUserFacingError(result.error),
          correlationId: result.correlationId || correlationId,
        },
        { status }
      );
    }

    const response = NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
      user: result.user,
      correlationId: result.correlationId || correlationId,
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
    logSecureError("AuthAPI.verifyOtp", err, {}, correlationId);
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_VERIFY_ERROR",
        error: "Unable to complete verification at this time. Please try again.",
        correlationId,
      },
      { status: 500 }
    );
  }
}
