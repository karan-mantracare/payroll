import { describe, it, expect, beforeAll } from "vitest";
import { isEmployeeInScope, getScopedEmployees, getScopedEmployeeById } from "../src/lib/scope/service";
import { SessionContext } from "../src/lib/permissions/types";
import { seedDatabase } from "../src/lib/db/seed";

describe("Turso Server-Side Data Scope Enforcement", () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  it("should restrict standard Employee (EMP-006) to SELF only", async () => {
    const employeeSession: SessionContext = {
      userId: "usr_employee",
      employeeId: "EMP-006",
      name: "Rohan Employee",
      email: "employee@mantracare.com",
      organizationId: "org_mc_global",
      departmentId: "dept_eng",
      roles: ["EMPLOYEE"],
      effectivePermissions: ["dash.dashboard.view", "dash.payroll.view"],
      widestScope: "SELF",
      managedDepartmentIds: [],
      managedTeamIds: [],
      directReportIds: [],
      isSuperAdmin: false,
    };

    // Access own record: ALLOWED
    const canAccessSelf = await isEmployeeInScope(employeeSession, "EMP-006");
    expect(canAccessSelf).toBe(true);

    // Cross-employee access (attempting to access EMP-005 manager): REJECTED
    const canAccessManager = await isEmployeeInScope(employeeSession, "EMP-005");
    expect(canAccessManager).toBe(false);

    // Cross-employee access (attempting to access EMP-001 CEO): REJECTED
    const canAccessCeo = await isEmployeeInScope(employeeSession, "EMP-001");
    expect(canAccessCeo).toBe(false);

    // Querying employee by ID directly returns null when out of scope
    const outOfScopeRecord = await getScopedEmployeeById(employeeSession, "EMP-001");
    expect(outOfScopeRecord).toBeNull();

    // Querying list returns exactly 1 record (self)
    const list = await getScopedEmployees(employeeSession);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("EMP-006");
  });

  it("should allow Team Manager (EMP-005) to view DIRECT_REPORTS (EMP-006) but reject other departments", async () => {
    const teamManagerSession: SessionContext = {
      userId: "usr_teammanager",
      employeeId: "EMP-005",
      name: "Vikram Team-Lead",
      email: "teammanager@mantracare.com",
      organizationId: "org_mc_global",
      departmentId: "dept_eng",
      roles: ["TEAM_MANAGER"],
      effectivePermissions: ["dash.team.view", "dash.team_approvals.manage"],
      widestScope: "DIRECT_REPORTS",
      managedDepartmentIds: [],
      managedTeamIds: ["team_fe"],
      directReportIds: ["EMP-006"],
      isSuperAdmin: false,
    };

    // Access self: ALLOWED
    expect(await isEmployeeInScope(teamManagerSession, "EMP-005")).toBe(true);

    // Access direct report (EMP-006): ALLOWED
    expect(await isEmployeeInScope(teamManagerSession, "EMP-006")).toBe(true);

    // Cross-department access (EMP-004 HR Executive): REJECTED
    expect(await isEmployeeInScope(teamManagerSession, "EMP-004")).toBe(false);

    // Access manager (EMP-002 Admin): REJECTED
    expect(await isEmployeeInScope(teamManagerSession, "EMP-002")).toBe(false);

    const list = await getScopedEmployees(teamManagerSession);
    const ids = list.map((e) => e.id);
    expect(ids).toContain("EMP-005");
    expect(ids).toContain("EMP-006");
    expect(ids).not.toContain("EMP-004");
    expect(ids).not.toContain("EMP-001");
  });

  it("should allow Admin and Super Admin full organization scope", async () => {
    const adminSession: SessionContext = {
      userId: "usr_admin",
      employeeId: "EMP-002",
      name: "Aakash Admin",
      email: "admin@mantracare.com",
      organizationId: "org_mc_global",
      departmentId: "dept_fin",
      roles: ["ADMIN"],
      effectivePermissions: ["admin.employees.view", "admin.payroll.view"],
      widestScope: "ORGANIZATION",
      managedDepartmentIds: ["dept_fin"],
      managedTeamIds: [],
      directReportIds: [],
      isSuperAdmin: false,
    };

    expect(await isEmployeeInScope(adminSession, "EMP-001")).toBe(true);
    expect(await isEmployeeInScope(adminSession, "EMP-006")).toBe(true);

    const allEmployees = await getScopedEmployees(adminSession);
    expect(allEmployees.length).toBe(7);
  });

  it("should enforce DEPARTMENT scope: HR Executive (dept_hr) cannot query Engineering (dept_eng)", async () => {
    const hrExecSession: SessionContext = {
      userId: "usr_hrexecutive",
      employeeId: "EMP-004",
      name: "Kavita HR-Executive",
      email: "hrexecutive@mantracare.com",
      organizationId: "org_mc_global",
      departmentId: "dept_hr",
      roles: ["HR_EXECUTIVE"],
      effectivePermissions: ["admin.employees.view"],
      widestScope: "DEPARTMENT",
      managedDepartmentIds: ["dept_hr"],
      managedTeamIds: ["team_hr_ops"],
      directReportIds: [],
      isSuperAdmin: false,
    };

    // Querying employee in own department (dept_hr): ALLOWED
    expect(await isEmployeeInScope(hrExecSession, "EMP-004")).toBe(true);
    expect(await isEmployeeInScope(hrExecSession, "EMP-003")).toBe(true); // Meera in dept_hr

    // Cross-department access: Engineering employee (EMP-006): REJECTED
    expect(await isEmployeeInScope(hrExecSession, "EMP-006")).toBe(false);
    expect(await isEmployeeInScope(hrExecSession, "EMP-005")).toBe(false);

    // Direct getScopedEmployeeById for out-of-scope employee returns null
    const crossDeptRecord = await getScopedEmployeeById(hrExecSession, "EMP-006");
    expect(crossDeptRecord).toBeNull();
  });
});

