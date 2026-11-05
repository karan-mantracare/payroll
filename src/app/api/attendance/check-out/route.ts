import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { recordCheckOut } from "@/lib/attendance/service";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const employeeId = body.employeeId || session.employeeId;

    if (!employeeId) {
      return NextResponse.json(
        { error: "EMPLOYEE_REQUIRED: Must provide employeeId or have active employee profile." },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await recordCheckOut(
      session,
      employeeId,
      {
        timestampUtc: body.timestampUtc,
        source: body.source || "WEB",
        ipAddress,
        deviceInfo: userAgent,
        notes: body.notes,
      },
      { ipAddress, userAgent }
    );

    return NextResponse.json({ success: true, attendance: result }, { status: 200 });
  } catch (err: any) {
    const status = err.message.includes("CHECK_IN_REQUIRED")
      ? 400
      : err.message.includes("UNAUTHORIZED")
      ? 403
      : err.message.includes("NOT_FOUND")
      ? 404
      : 500;

    return NextResponse.json({ error: err.message }, { status });
  }
}
