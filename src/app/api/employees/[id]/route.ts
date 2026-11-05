import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getEmployeeDetail, updateEmployee } from "@/lib/employees/service";

export async function GET(
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
    const employee = await getEmployeeDetail(session, id);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found or inaccessible under your data scope" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: employee,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch employee", details: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const updated = await updateEmployee(session, id, body, { ipAddress, userAgent });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Employee successfully updated",
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

