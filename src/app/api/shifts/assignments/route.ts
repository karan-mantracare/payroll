import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { assignShiftToEmployee, getEmployeeShiftCalendar } from "@/lib/shifts/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") || session.employeeId;
    const startDate = searchParams.get("startDate") || new Date().toISOString().split("T")[0];
    const endDate = searchParams.get("endDate") || startDate;

    if (!employeeId) {
      return NextResponse.json({ error: "EMPLOYEE_REQUIRED: employeeId parameter required." }, { status: 400 });
    }

    const calendar = await getEmployeeShiftCalendar(session, employeeId, startDate, endDate);
    return NextResponse.json({ success: true, calendar });
  } catch (err: any) {
    const status = err.message.includes("UNAUTHORIZED") || err.message.includes("SCOPE_")
      ? 403
      : 500;
    return NextResponse.json({ error: err.message }, { status });
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

    const result = await assignShiftToEmployee(session, body, { ipAddress, userAgent });
    return NextResponse.json({ success: true, assignment: result }, { status: 201 });
  } catch (err: any) {
    const status = err.message.includes("UNAUTHORIZED") || err.message.includes("SCOPE_")
      ? 403
      : err.message.includes("NOT_FOUND")
      ? 404
      : 400;

    return NextResponse.json({ error: err.message }, { status });
  }
}

