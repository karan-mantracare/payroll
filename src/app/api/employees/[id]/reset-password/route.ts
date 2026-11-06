import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { adminResetEmployeePassword } from "@/lib/auth/password-reset";
import { generateCorrelationId, logSecureError, sanitizeUserFacingError } from "@/lib/security/safe-logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = generateCorrelationId("api_adm_pwd");
  const { id: employeeId } = await params;

  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED: Authentication required.", correlationId },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const result = await adminResetEmployeePassword(session, {
      employeeIdOrCode: employeeId,
      newPassword: body.newPassword,
      meta: { ipAddress, userAgent },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    logSecureError("AdminAPI.resetPassword", err, { employeeId }, correlationId);
    const msg = err.message || "";
    const status = msg.includes("UNAUTHORIZED")
      ? 403
      : msg.includes("EMPLOYEE_NOT_FOUND")
      ? 404
      : msg.includes("INVALID_PASSWORD")
      ? 400
      : 500;

    return NextResponse.json(
      {
        success: false,
        error: sanitizeUserFacingError(err.message, "Unable to reset password."),
        correlationId,
      },
      { status }
    );
  }
}

