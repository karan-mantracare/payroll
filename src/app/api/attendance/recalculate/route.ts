import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { recalculateAttendance } from "@/lib/attendance/service";
import { generateCorrelationId, logSecureError, sanitizeUserFacingError } from "@/lib/security/safe-logger";

export async function POST(req: NextRequest) {
  const correlationId = generateCorrelationId("api_att_recalc");

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

    const summary = await recalculateAttendance(
      session,
      {
        month: body.month || undefined,
        startDate: body.startDate || undefined,
        endDate: body.endDate || undefined,
        employeeId: body.employeeId || undefined,
      },
      { ipAddress, userAgent }
    );

    return NextResponse.json({
      success: true,
      summary,
      correlationId,
    });
  } catch (err: any) {
    logSecureError("AttendanceAPI.recalculate", err, {}, correlationId);
    const msg = err.message || "";
    const status = msg.includes("UNAUTHORIZED") ? 403 : 500;

    return NextResponse.json(
      {
        success: false,
        error: sanitizeUserFacingError(err.message, "Attendance recalculation failed."),
        correlationId,
      },
      { status }
    );
  }
}
