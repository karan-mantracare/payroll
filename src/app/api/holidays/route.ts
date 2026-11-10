import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import {
  getHolidayCalendar,
  addHoliday,
  bulkImportHolidays,
  deleteHoliday,
} from "@/lib/leaves/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const holidays = getHolidayCalendar();
    return NextResponse.json({ success: true, holidays });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage =
      session.isSuperAdmin ||
      session.roles.includes("SUPER_ADMIN") ||
      session.roles.includes("ADMIN") ||
      session.roles.includes("HR_MANAGER");

    if (!canManage) {
      return NextResponse.json(
        { error: "Insufficient permissions to manage holidays" },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Check if bulk import or single add
    if (body.holidays && Array.isArray(body.holidays)) {
      const imported = bulkImportHolidays(body.holidays);
      return NextResponse.json({ success: true, count: body.holidays.length, holidays: imported });
    }

    // Single add
    if (!body.name || !body.date) {
      return NextResponse.json(
        { error: "Holiday name and date are required" },
        { status: 400 }
      );
    }

    const dateObj = new Date(`${body.date}T12:00:00Z`);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayOfWeek = dayNames[dateObj.getUTCDay()] || "Unknown";

    const created = addHoliday({
      name: body.name.trim(),
      date: body.date,
      dayOfWeek,
      type: body.type || "Gazetted",
      location: body.location || "All Locations",
      description: body.description || "",
    });

    return NextResponse.json({ success: true, holiday: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Holiday id required" }, { status: 400 });
    }

    const success = deleteHoliday(id);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

