import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { changeReportingManager } from "@/lib/hierarchy/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    if (!body.reason || !body.reason.trim()) {
      return NextResponse.json({ error: "A valid reason for the manager change is required." }, { status: 400 });
    }

    if (!body.effectiveDate || !body.effectiveDate.trim()) {
      return NextResponse.json({ error: "Effective date is required." }, { status: 400 });
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await changeReportingManager(
      session,
      id,
      {
        newManagerId: body.newManagerId !== undefined ? body.newManagerId : null,
        reason: body.reason,
        effectiveDate: body.effectiveDate,
        concurrencyVersion: body.concurrencyVersion,
      },
      { ipAddress, userAgent }
    );

    return NextResponse.json({
      success: true,
      message: "Reporting manager changed successfully.",
      data: result,
    });
  } catch (error: any) {
    const isConflict = error.message?.includes("CONCURRENCY_CONFLICT");
    const isCircular = error.message?.includes("CIRCULAR_REPORTING_NOT_ALLOWED") || error.message?.includes("SELF_REPORTING_NOT_ALLOWED");
    const status = isConflict ? 409 : isCircular ? 422 : error.message?.includes("Unauthorized") ? 403 : 400;

    return NextResponse.json(
      { error: error.message || "Failed to change reporting manager" },
      { status }
    );
  }
}

