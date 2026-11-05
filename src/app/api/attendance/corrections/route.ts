import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { requestAttendanceCorrection } from "@/lib/attendance/service";
import { db } from "@/lib/db/client";
import { attendanceCorrectionRequests, employees, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const isHrOrAdmin =
      session.isSuperAdmin ||
      session.roles.includes("SUPER_ADMIN") ||
      session.roles.includes("ADMIN") ||
      session.roles.includes("HR_MANAGER") ||
      session.effectivePermissions.includes("admin.attendance.manage");

    const query = db
      .select({
        id: attendanceCorrectionRequests.id,
        employeeId: attendanceCorrectionRequests.employeeId,
        employeeCode: employees.employeeCode,
        employeeName: users.name,
        requestedDate: attendanceCorrectionRequests.requestedDate,
        requestedCheckInUtc: attendanceCorrectionRequests.requestedCheckInUtc,
        requestedCheckOutUtc: attendanceCorrectionRequests.requestedCheckOutUtc,
        reason: attendanceCorrectionRequests.reason,
        status: attendanceCorrectionRequests.status,
        rejectionReason: attendanceCorrectionRequests.rejectionReason,
        createdAt: attendanceCorrectionRequests.createdAt,
      })
      .from(attendanceCorrectionRequests)
      .innerJoin(employees, eq(attendanceCorrectionRequests.employeeId, employees.id))
      .innerJoin(users, eq(employees.userId, users.id))
      .orderBy(desc(attendanceCorrectionRequests.createdAt));

    const rows = isHrOrAdmin
      ? await query
      : await query.where(eq(attendanceCorrectionRequests.employeeId, session.employeeId || ""));

    return NextResponse.json({ success: true, requests: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const body = await req.json();
    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await requestAttendanceCorrection(session, body, { ipAddress, userAgent });
    return NextResponse.json({ success: true, request: result }, { status: 201 });
  } catch (err: any) {
    const status = err.message.includes("REASON_REQUIRED") ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
