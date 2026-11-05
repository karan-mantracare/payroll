import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { reviewAttendanceCorrection } from "@/lib/attendance/service";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await reviewAttendanceCorrection(
      session,
      id,
      {
        status: body.status,
        rejectionReason: body.rejectionReason,
      },
      { ipAddress, userAgent }
    );

    return NextResponse.json({ success: true, review: result });
  } catch (err: any) {
    const status = err.message.includes("UNAUTHORIZED")
      ? 403
      : err.message.includes("NOT_FOUND")
      ? 404
      : 400;

    return NextResponse.json({ error: err.message }, { status });
  }
}
