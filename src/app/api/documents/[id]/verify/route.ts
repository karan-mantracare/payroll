import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { verifyEmployeeDocument } from "@/lib/documents/service";

export async function POST(
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

    if (!body.status || (body.status !== "VERIFIED" && body.status !== "REJECTED")) {
      return NextResponse.json(
        { error: "INVALID_STATUS: Status must be either 'VERIFIED' or 'REJECTED'." },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await verifyEmployeeDocument(
      session,
      id,
      {
        status: body.status,
        rejectionReason: body.rejectionReason,
      },
      { ipAddress, userAgent }
    );

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    const status = err.message.includes("SCOPE_VIOLATION") || err.message.includes("UNAUTHORIZED")
      ? 403
      : err.message.includes("REJECTION_REASON_REQUIRED") || err.message.includes("INVALID_")
      ? 400
      : err.message.includes("DOCUMENT_NOT_FOUND")
      ? 404
      : 500;

    return NextResponse.json({ error: err.message }, { status });
  }
}

