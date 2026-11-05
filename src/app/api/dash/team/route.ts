import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { employees, users, departments, locations, teams } from "@/lib/db/schema";
import { eq, or, and, ne } from "drizzle-orm";
import { getDirectReports, getManagerChain } from "@/lib/hierarchy/service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.employeeId) {
      return NextResponse.json({ error: "No employee profile found for user" }, { status: 404 });
    }

    // 1. Fetch current employee details
    const currentEmpRows = await db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        name: users.name,
        email: users.email,
        jobTitle: employees.jobTitle,
        departmentId: employees.departmentId,
        departmentName: departments.name,
        locationName: locations.name,
        teamName: teams.name,
        managerId: employees.managerId,
        status: employees.status,
      })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(locations, eq(employees.locationId, locations.id))
      .leftJoin(teams, eq(employees.teamId, teams.id))
      .where(or(eq(employees.id, session.employeeId), eq(employees.employeeCode, session.employeeId)))
      .limit(1);

    if (currentEmpRows.length === 0) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const currentEmp = currentEmpRows[0];

    // 2. Direct reports (if user is a manager)
    let directReports: any[] = [];
    try {
      directReports = await getDirectReports(currentEmp.id, session);
    } catch {
      directReports = [];
    }

    // 3. Manager Chain
    const managerChain = await getManagerChain(currentEmp.id, session);

    // 4. Manager Profile
    let manager = null;
    if (currentEmp.managerId) {
      const mgrRows = await db
        .select({
          id: employees.id,
          employeeCode: employees.employeeCode,
          name: users.name,
          email: users.email,
          jobTitle: employees.jobTitle,
          departmentName: departments.name,
          locationName: locations.name,
        })
        .from(employees)
        .innerJoin(users, eq(employees.userId, users.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(locations, eq(employees.locationId, locations.id))
        .where(or(eq(employees.id, currentEmp.managerId), eq(employees.employeeCode, currentEmp.managerId)))
        .limit(1);

      if (mgrRows.length > 0) {
        manager = mgrRows[0];
      }
    }

    // 5. Peers (Employees with the same manager, excluding self)
    let peers: any[] = [];
    if (currentEmp.managerId) {
      peers = await db
        .select({
          id: employees.id,
          employeeCode: employees.employeeCode,
          name: users.name,
          email: users.email,
          jobTitle: employees.jobTitle,
          departmentName: departments.name,
          locationName: locations.name,
          teamName: teams.name,
          status: employees.status,
        })
        .from(employees)
        .innerJoin(users, eq(employees.userId, users.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(locations, eq(employees.locationId, locations.id))
        .leftJoin(teams, eq(employees.teamId, teams.id))
        .where(
          and(
            or(eq(employees.managerId, currentEmp.managerId), eq(employees.managerId, manager?.id || currentEmp.managerId)),
            ne(employees.id, currentEmp.id)
          )
        );
    }

    return NextResponse.json({
      currentEmployee: currentEmp,
      manager,
      directReports,
      peers,
      managerChain,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch team data" },
      { status: 500 }
    );
  }
}

