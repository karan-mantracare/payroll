import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { listShifts, createShift, updateShift } from "@/lib/shifts/service";

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

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "Shift ID is required" }, { status: 400 });
    }

    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const updated = await updateShift(session, body, { ipAddress, userAgent });
    return NextResponse.json({ success: true, shift: updated });
  } catch (err: any) {
    const status = err.message.includes("UNAUTHORIZED")
      ? 403
      : err.message.includes("EXISTS") || err.message.includes("INVALID_") || err.message.includes("NOT_FOUND")
      ? 400
      : 500;

    return NextResponse.json({ error: err.message }, { status });
  }
}

