import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getLeaveQuotas, bulkUpdateLeaveQuotas } from "@/lib/leaves/service";
import { db } from "@/lib/db/client";
import { employees, users, departments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all active employees joined with users
    const allEmployees = await db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        name: users.name,
        email: users.email,
        departmentId: employees.departmentId,
        departmentName: departments.name,
        status: employees.status,
      })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(eq(employees.status, "ACTIVE"));

    const savedQuotas = getLeaveQuotas();

    // Merge quotas with employee list, applying enterprise defaults (PL: 18, CL: 12, SL: 10)
    const result = allEmployees.map((emp) => {
      const q = savedQuotas[emp.id];
      const pl = q !== undefined ? q.privilegeLeave : 18;
      const cl = q !== undefined ? q.casualLeave : 12;
      const sl = q !== undefined ? q.sickLeave : 10;
      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        name: emp.name,
        email: emp.email,
        departmentId: emp.departmentId,
        departmentName: emp.departmentName || "General",
        privilegeLeave: pl,
        casualLeave: cl,
        sickLeave: sl,
        totalQuota: pl + cl + sl,
        updatedAt: q?.updatedAt,
      };
    });

    return NextResponse.json({ success: true, employees: result });
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
        { error: "Insufficient permissions to edit leave quotas" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updates = Array.isArray(body.updates) ? body.updates : [body];

    const updated = bulkUpdateLeaveQuotas(updates);
    return NextResponse.json({ success: true, quotas: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
