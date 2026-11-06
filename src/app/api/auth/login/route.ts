import { NextRequest, NextResponse } from "next/server";
import { initiateLoginChallenge } from "@/lib/auth/direct";
import { generateCorrelationId, logSecureError, sanitizeUserFacingError } from "@/lib/security/safe-logger";

export async function POST(req: NextRequest) {
  const correlationId = generateCorrelationId("api_login");

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "Please enter your work email and password.",
          correlationId,
        },
        { status: 400 }
      );
    }

    const { email, password } = body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        {
          success: false,
          code: "MISSING_CREDENTIALS",
          error: "Please enter both your work email and password.",
          correlationId,
        },
        { status: 400 }
      );
    }

    const result = await initiateLoginChallenge(email, password);

    if (!result.success) {
      const status =
        result.code === "ACCOUNT_LOCKED"
          ? 423 // Locked
          : result.code === "EMPLOYEE_INACTIVE" || result.code === "ACCOUNT_INACTIVE"
          ? 403 // Forbidden
          : 401; // Unauthorized

      return NextResponse.json(
        {
          success: false,
          code: result.code || "AUTH_FAILED",
          error: sanitizeUserFacingError(result.error),
          correlationId: result.correlationId || correlationId,
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      challengeToken: result.challengeToken,
      emailMasked: result.emailMasked,
      expiresAt: result.expiresAt,
      isDevStaticEnabled: result.isDevStaticEnabled,
      correlationId: result.correlationId || correlationId,
    });
  } catch (err: any) {
    logSecureError("AuthAPI.login", err, {}, correlationId);
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_AUTH_ERROR",
        error: "Unable to complete sign-in right now. Please try again.",
        correlationId,
      },
      { status: 500 }
    );
  }
}
