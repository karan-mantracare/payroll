import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { reviewShiftChangeRequest } from "@/lib/shifts/service";

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

    const result = await reviewShiftChangeRequest(
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
    const msg = err.message || "";
    const status = msg.includes("UNAUTHORIZED") || msg.includes("SCOPE_")
      ? 403
      : msg.includes("NOT_FOUND")
      ? 404
      : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}

