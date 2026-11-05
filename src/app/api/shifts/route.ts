import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { listShifts, createShift } from "@/lib/shifts/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const shifts = await listShifts(session);
    return NextResponse.json({ success: true, shifts });
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

    const created = await createShift(session, body, { ipAddress, userAgent });
    return NextResponse.json({ success: true, shift: created }, { status: 201 });
  } catch (err: any) {
    const status = err.message.includes("UNAUTHORIZED")
      ? 403
      : err.message.includes("EXISTS") || err.message.includes("INVALID_")
      ? 400
      : 500;

    return NextResponse.json({ error: err.message }, { status });
  }
}
