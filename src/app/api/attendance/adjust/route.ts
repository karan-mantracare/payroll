import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { manualAttendanceAdjustment } from "@/lib/attendance/service";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const body = await req.json();
    const { employeeId, date, checkInTimeUtc, checkOutTimeUtc, status, notes } = body;

    if (!employeeId || !date || !checkInTimeUtc || !checkOutTimeUtc || !notes) {
      return NextResponse.json(
        { error: "INVALID_INPUT: employeeId, date, checkInTimeUtc, checkOutTimeUtc, and notes are required." },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await manualAttendanceAdjustment(
      session,
      employeeId,
      {
        date,
        checkInTimeUtc,
        checkOutTimeUtc,
        status,
        notes,
      },
      { ipAddress, userAgent }
    );

    return NextResponse.json({ success: true, adjustment: result });
  } catch (err: any) {
    const status = err.message.includes("UNAUTHORIZED")
      ? 403
      : err.message.includes("NOT_FOUND")
      ? 404
      : 400;

    return NextResponse.json({ error: err.message }, { status });
  }
}
