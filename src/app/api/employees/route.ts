import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { listEmployees, createEmployee } from "@/lib/employees/service";
import { db } from "@/lib/db/client";
import { departments, locations, teams } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const search = searchParams.get("search") || undefined;
    const departmentId = searchParams.get("departmentId") || undefined;
    const locationId = searchParams.get("locationId") || undefined;
    const teamId = searchParams.get("teamId") || undefined;
    const status = searchParams.get("status") || undefined;
    const employmentType = searchParams.get("employmentType") || undefined;
    const sortBy = (searchParams.get("sortBy") as any) || undefined;
    const sortOrder = (searchParams.get("sortOrder") as any) || undefined;

    const result = await listEmployees(session, {
      page,
      pageSize,
      search,
      departmentId,
      locationId,
      teamId,
      status,
      employmentType,
      sortBy,
      sortOrder,
    });

    // Also fetch lookup lists for UI filter dropdowns
    const [deptList, locList, teamList] = await Promise.all([
      db.select({ id: departments.id, name: departments.name }).from(departments),
      db.select({ id: locations.id, name: locations.name }).from(locations),
      db.select({ id: teams.id, name: teams.name }).from(teams),
    ]);

    return NextResponse.json({
      data: result.employees,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      filters: {
        departments: deptList,
        locations: locList,
        teams: teamList,
      },
      scope: session.widestScope,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch employees", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const created = await createEmployee(session, body, { ipAddress, userAgent });

    return NextResponse.json(
      {
        success: true,
        data: created,
        message: "Employee successfully created",
      },
      { status: 201 }
    );
  } catch (err: any) {
    const status = err.message.includes("Unauthorized")
      ? 403
      : err.name === "ZodError" || err.message.includes("Invalid")
      ? 400
      : 500;

    return NextResponse.json(
      { error: err.message, details: err.errors || undefined },
      { status }
    );
  }
}
