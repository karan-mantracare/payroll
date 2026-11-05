import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { transitionEmployeeStatus } from "@/lib/employees/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await transitionEmployeeStatus(session, id, body, { ipAddress, userAgent });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Employee status transitioned from ${result.previousStatus} to ${result.newStatus}`,
    });
  } catch (err: any) {
    const status = err.message.includes("Unauthorized")
      ? 403
      : err.message.includes("CONCURRENCY_CONFLICT")
      ? 409
      : err.message.includes("not found")
      ? 404
      : 400;

    return NextResponse.json(
      { error: err.message, details: err.errors || undefined },
      { status }
    );
  }
}

