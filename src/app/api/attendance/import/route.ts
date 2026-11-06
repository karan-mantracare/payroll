import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { importMonthlyAttendance, AttendanceImportRow } from "@/lib/attendance/service";
import { generateCorrelationId, logSecureError, sanitizeUserFacingError } from "@/lib/security/safe-logger";

export async function POST(req: NextRequest) {
  const correlationId = generateCorrelationId("api_att_imp");

  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED: Authentication required.", correlationId },
        { status: 401 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let rows: AttendanceImportRow[] = [];

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      if (!body || !Array.isArray(body.rows)) {
        return NextResponse.json(
          { success: false, error: "INVALID_PAYLOAD: Expected { rows: AttendanceImportRow[] }.", correlationId },
          { status: 400 }
        );
      }
      rows = body.rows;
    } else {
      // Parse plain CSV text
      const text = await req.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length <= 1) {
        return NextResponse.json(
          { success: false, error: "EMPTY_CSV: No data rows found in CSV.", correlationId },
          { status: 400 }
        );
      }

      // Format: EmployeeCode,Date,CheckIn,CheckOut,Status,Notes
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const codeIdx = headers.findIndex((h) => h.includes("code") || h.includes("id"));
      const dateIdx = headers.findIndex((h) => h.includes("date"));
      const inIdx = headers.findIndex((h) => h.includes("in"));
      const outIdx = headers.findIndex((h) => h.includes("out"));
      const statusIdx = headers.findIndex((h) => h.includes("status"));
      const notesIdx = headers.findIndex((h) => h.includes("note"));

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        if (parts.length < 3) continue;

        rows.push({
          employeeCode: parts[codeIdx !== -1 ? codeIdx : 0] || "",
          date: parts[dateIdx !== -1 ? dateIdx : 1] || "",
          checkInTime: parts[inIdx !== -1 ? inIdx : 2] || "",
          checkOutTime: outIdx !== -1 ? parts[outIdx] : undefined,
          status: statusIdx !== -1 ? (parts[statusIdx] as any) : undefined,
          notes: notesIdx !== -1 ? parts[notesIdx] : undefined,
        });
      }
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const result = await importMonthlyAttendance(session, rows, { ipAddress, userAgent });

    return NextResponse.json({
      success: true,
      result,
      correlationId,
    });
  } catch (err: any) {
    logSecureError("AttendanceAPI.import", err, {}, correlationId);
    const msg = err.message || "";
    const status = msg.includes("UNAUTHORIZED")
      ? 403
      : msg.includes("INVALID_PAYLOAD") || msg.includes("EMPTY_CSV")
      ? 400
      : 500;

    return NextResponse.json(
      {
        success: false,
        error: sanitizeUserFacingError(err.message, "Attendance import failed."),
        correlationId,
      },
      { status }
    );
  }
}

