import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset, confirmPasswordReset } from "@/lib/auth/password-reset";
import { generateCorrelationId, logSecureError, sanitizeUserFacingError } from "@/lib/security/safe-logger";

export async function POST(req: NextRequest) {
  const correlationId = generateCorrelationId("api_pw_reset");

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid request payload.", correlationId },
        { status: 400 }
      );
    }

    const { action } = body;
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    if (action === "request") {
      const { email } = body;
      if (!email || typeof email !== "string") {
        return NextResponse.json(
          { success: false, message: "Please provide a valid work email address.", correlationId },
          { status: 400 }
        );
      }

      const result = await requestPasswordReset(email, { ipAddress, userAgent });
      return NextResponse.json(result);
    } else if (action === "confirm") {
      const { token, newPassword } = body;
      if (!token || !newPassword) {
        return NextResponse.json(
          { success: false, message: "Reset token and new password are required.", correlationId },
          { status: 400 }
        );
      }

      const result = await confirmPasswordReset({ token, newPassword, meta: { ipAddress, userAgent } });
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    return NextResponse.json(
      { success: false, message: "Invalid action. Allowed: 'request', 'confirm'.", correlationId },
      { status: 400 }
    );
  } catch (err: any) {
    logSecureError("AuthAPI.resetPassword", err, {}, correlationId);
    return NextResponse.json(
      {
        success: false,
        message: "Unable to process password reset request. Please try again.",
        correlationId,
      },
      { status: 500 }
    );
  }
}

