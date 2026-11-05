import { describe, it, expect } from "vitest";
import { resolveUserPermissions, hasPermission, hasPortalAccess } from "../src/lib/permissions/evaluator";
import { PORTAL_PERMISSIONS, SENSITIVE_PERMISSIONS, ADMIN_MODULE_PERMISSIONS, DASH_MODULE_PERMISSIONS } from "../src/lib/permissions/types";

describe("Permission Registry & Multi-Role Combination", () => {
  it("should grant Super Admin absolute bypass access to all portals and permissions", () => {
    const resolved = resolveUserPermissions(["SUPER_ADMIN"]);
    expect(resolved.isSuperAdmin).toBe(true);
    expect(resolved.widestScope).toBe("ORGANIZATION");

    const dummyContext = {
      userId: "usr_1",
      name: "SuperAdmin",
      email: "sa@mc.com",
      organizationId: "org_1",
      roles: ["SUPER_ADMIN"],
      effectivePermissions: Array.from(resolved.effectivePermissions),
      widestScope: resolved.widestScope,
      managedDepartmentIds: [],
      managedTeamIds: [],
      directReportIds: [],
      isSuperAdmin: true,
    };

    expect(hasPermission(dummyContext, "non.existent.random.permission")).toBe(true);
    expect(hasPortalAccess(dummyContext, "admin")).toBe(true);
    expect(hasPortalAccess(dummyContext, "employee")).toBe(true);
  });

  it("should restrict standard Employee to employee portal and self scope", () => {
    const resolved = resolveUserPermissions(["EMPLOYEE"]);
    expect(resolved.isSuperAdmin).toBe(false);
    expect(resolved.widestScope).toBe("SELF");

    const dummyContext = {
      userId: "usr_2",
      name: "Employee",
      email: "emp@mc.com",
      organizationId: "org_1",
      roles: ["EMPLOYEE"],
      effectivePermissions: Array.from(resolved.effectivePermissions),
      widestScope: resolved.widestScope,
      managedDepartmentIds: [],
      managedTeamIds: [],
      directReportIds: [],
      isSuperAdmin: false,
    };

    expect(hasPortalAccess(dummyContext, "employee")).toBe(true);
    expect(hasPortalAccess(dummyContext, "admin")).toBe(false);
    expect(hasPermission(dummyContext, DASH_MODULE_PERMISSIONS.DASHBOARD_VIEW)).toBe(true);
    expect(hasPermission(dummyContext, DASH_MODULE_PERMISSIONS.TEAM_VIEW)).toBe(false);
    expect(hasPermission(dummyContext, ADMIN_MODULE_PERMISSIONS.EMPLOYEES_VIEW)).toBe(false);
    expect(hasPermission(dummyContext, SENSITIVE_PERMISSIONS.SALARY_READ)).toBe(false);
  });

  it("should grant Team Manager team modules but NOT admin portal by default", () => {
    const resolved = resolveUserPermissions(["TEAM_MANAGER"]);
    expect(resolved.widestScope).toBe("DIRECT_REPORTS");

    const dummyContext = {
      userId: "usr_3",
      name: "Manager",
      email: "tm@mc.com",
      organizationId: "org_1",
      roles: ["TEAM_MANAGER"],
      effectivePermissions: Array.from(resolved.effectivePermissions),
      widestScope: resolved.widestScope,
      managedDepartmentIds: [],
      managedTeamIds: [],
      directReportIds: ["emp_sub_1"],
      isSuperAdmin: false,
    };

    expect(hasPortalAccess(dummyContext, "employee")).toBe(true);
    expect(hasPortalAccess(dummyContext, "admin")).toBe(false); // By default, no admin portal!
    expect(hasPermission(dummyContext, DASH_MODULE_PERMISSIONS.TEAM_VIEW)).toBe(true);
    expect(hasPermission(dummyContext, DASH_MODULE_PERMISSIONS.TEAM_APPROVALS_MANAGE)).toBe(true);
  });

  it("should correctly aggregate multi-role user (Employee + Team Manager + Admin)", () => {
    // User holds Employee, Team Manager, and Admin simultaneously
    const resolved = resolveUserPermissions(["EMPLOYEE", "TEAM_MANAGER", "ADMIN"]);
    expect(resolved.isSuperAdmin).toBe(false);

    // Widest scope must expand to ORGANIZATION (from Admin role)
    expect(resolved.widestScope).toBe("ORGANIZATION");

    const dummyContext = {
      userId: "usr_multi",
      name: "MultiRole",
      email: "multi@mc.com",
      organizationId: "org_1",
      roles: ["EMPLOYEE", "TEAM_MANAGER", "ADMIN"],
      effectivePermissions: Array.from(resolved.effectivePermissions),
      widestScope: resolved.widestScope,
      managedDepartmentIds: ["dept_1"],
      managedTeamIds: ["team_1"],
      directReportIds: ["emp_sub_1"],
      isSuperAdmin: false,
    };

    // Both portals must be accessible
    expect(hasPortalAccess(dummyContext, "admin")).toBe(true);
    expect(hasPortalAccess(dummyContext, "employee")).toBe(true);

    // Permissions from all three roles must be unified
    expect(hasPermission(dummyContext, DASH_MODULE_PERMISSIONS.PROFILE_VIEW)).toBe(true); // From Employee
    expect(hasPermission(dummyContext, DASH_MODULE_PERMISSIONS.TEAM_VIEW)).toBe(true); // From Team Manager
    expect(hasPermission(dummyContext, ADMIN_MODULE_PERMISSIONS.PAYROLL_VIEW)).toBe(true); // From Admin
    expect(hasPermission(dummyContext, SENSITIVE_PERMISSIONS.SALARY_READ)).toBe(true); // From Admin
  });

  it("should confirm Admin Portal access is controlled by explicit portal.admin.access permission, NOT role name", () => {
    // Case 1: Custom role or Employee explicitly granted 'portal.admin.access'
    const customUserWithAdminAccess = {
      userId: "usr_custom_admin",
      name: "Custom Delegated Admin",
      email: "delegated@mc.com",
      organizationId: "org_1",
      roles: ["EMPLOYEE"], // Role name is just EMPLOYEE
      effectivePermissions: ["portal.admin.access", "portal.employee.access"], // Explicit permission granted!
      widestScope: "SELF" as const,
      managedDepartmentIds: [],
      managedTeamIds: [],
      directReportIds: [],
      isSuperAdmin: false,
    };

    // Must be granted entry into Admin Portal because of explicit permission
    expect(hasPortalAccess(customUserWithAdminAccess, "admin")).toBe(true);

    // Case 2: User with role name 'TEAM_MANAGER' lacking 'portal.admin.access'
    const managerWithoutAdminAccess = {
      userId: "usr_manager_no_admin",
      name: "Team Lead",
      email: "lead@mc.com",
      organizationId: "org_1",
      roles: ["TEAM_MANAGER"],
      effectivePermissions: ["portal.employee.access", "dash.team.view"], // No portal.admin.access
      widestScope: "DIRECT_REPORTS" as const,
      managedDepartmentIds: [],
      managedTeamIds: [],
      directReportIds: [],
      isSuperAdmin: false,
    };

    // Must be DENIED entry into Admin Portal despite being a Manager
    expect(hasPortalAccess(managerWithoutAdminAccess, "admin")).toBe(false);
  });

  it("should verify default permissions and scopes for all six system roles", () => {
    const roles: Array<{ key: any; expectedScope: string; canAdmin: boolean; canEmployee: boolean }> = [
      { key: "SUPER_ADMIN", expectedScope: "ORGANIZATION", canAdmin: true, canEmployee: true },
      { key: "ADMIN", expectedScope: "ORGANIZATION", canAdmin: true, canEmployee: true },
      { key: "HR_MANAGER", expectedScope: "ORGANIZATION", canAdmin: true, canEmployee: true },
      { key: "HR_EXECUTIVE", expectedScope: "DEPARTMENT", canAdmin: true, canEmployee: true },
      { key: "TEAM_MANAGER", expectedScope: "DIRECT_REPORTS", canAdmin: false, canEmployee: true },
      { key: "EMPLOYEE", expectedScope: "SELF", canAdmin: false, canEmployee: true },
    ];

    for (const r of roles) {
      const resolved = resolveUserPermissions([r.key]);
      expect(resolved.widestScope).toBe(r.expectedScope);

      const ctx = {
        userId: `usr_${r.key}`,
        name: r.key,
        email: `${r.key.toLowerCase()}@mc.com`,
        organizationId: "org_1",
        roles: [r.key],
        effectivePermissions: Array.from(resolved.effectivePermissions),
        widestScope: resolved.widestScope,
        managedDepartmentIds: [],
        managedTeamIds: [],
        directReportIds: [],
        isSuperAdmin: resolved.isSuperAdmin,
      };

      expect(hasPortalAccess(ctx, "admin")).toBe(r.canAdmin);
      expect(hasPortalAccess(ctx, "employee")).toBe(r.canEmployee);
    }
  });
});

