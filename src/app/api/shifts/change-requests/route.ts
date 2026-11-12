import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getShiftChangeRequests, requestShiftChange } from "@/lib/shifts/service";

export async function GET() {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const requests = await getShiftChangeRequests(session);
    return NextResponse.json({ success: true, requests });
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

    const result = await requestShiftChange(session, body, { ipAddress, userAgent });
    return NextResponse.json({ success: true, request: result }, { status: 201 });
  } catch (err: any) {
    const msg = err.message || "";
    const status =
      msg.includes("REQUIRED") || msg.includes("INVALID_")
        ? 400
        : msg.includes("NOT_FOUND")
        ? 404
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

