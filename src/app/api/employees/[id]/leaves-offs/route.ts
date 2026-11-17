import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import {
  getEmployeeLeavesOffs,
  saveEmployeeLeavesOffs,
} from "@/lib/leaves/employee-leaves-offs";
import { resolveEmployee } from "@/lib/hierarchy/service";

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
    const employee = await resolveEmployee(id);
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const data = getEmployeeLeavesOffs(employee.employeeCode || employee.id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch leaves and offs settings", details: err.message },
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

    // Permission check: SuperAdmin, Admin, HR Manager, or attendance/leave manager
    const canManage =
      session.isSuperAdmin ||
      session.roles.includes("ADMIN") ||
      session.roles.includes("HR_MANAGER") ||
      session.effectivePermissions.includes("employee.edit") ||
      session.effectivePermissions.includes("attendance.manage");

    if (!canManage) {
      return NextResponse.json(
        { error: "Unauthorized: Insufficient permissions to modify leaves and offs policy" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const employee = await resolveEmployee(id);
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const updated = saveEmployeeLeavesOffs(
      employee.id,
      body,
      session.userId,
      employee.employeeCode
    );

    return NextResponse.json({
      success: true,
      message: "Leaves and offs settings saved successfully",
      data: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to save leaves and offs settings", details: err.message },
      { status: 500 }
    );
  }
}
