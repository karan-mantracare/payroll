import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getTodayAttendanceStatus } from "@/lib/attendance/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") || session.employeeId;

    if (!employeeId) {
      return NextResponse.json({ error: "EMPLOYEE_REQUIRED: employeeId required." }, { status: 400 });
    }

    const status = await getTodayAttendanceStatus(session, employeeId);
    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

