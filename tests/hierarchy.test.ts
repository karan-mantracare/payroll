import { describe, it, expect, beforeEach, vi } from "vitest";
import { seedDatabase } from "../src/lib/db/seed";
import { db } from "../src/lib/db/client";
import {
  getDirectReports,
  getManagerChain,
  getAllSubordinates,
  getReportingHierarchy,
  validateReportingHierarchy,
  changeReportingManager,
  getManagerHistory,
  MAX_TRAVERSAL_DEPTH,
} from "../src/lib/hierarchy/service";
import { SessionContext } from "../src/lib/permissions/types";
import { auditLogs, employeeManagerHistory, employees } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyAuditLogChain } from "../src/lib/audit/logger";
import * as auditModule from "../src/lib/audit/logger";

describe("Phase 2B — Reporting Hierarchy & Organizational Tree Engine", () => {
  const adminSession: SessionContext = {
    userId: "usr_admin",
    employeeId: "EMP-002",
    name: "Aakash Admin",
    email: "admin@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["ADMIN"],
    effectivePermissions: [
      "portal.admin.access",
      "hierarchy.read",
      "hierarchy.manage",
      "hierarchy.history.read",
      "team.direct_reports.read",
      "team.reporting_hierarchy.read",
    ],
    widestScope: "ORGANIZATION",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  const hrManagerSession: SessionContext = {
    userId: "usr_hrmanager",
    employeeId: "EMP-003",
    name: "Meera HR-Manager",
    email: "hrmanager@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["HR_MANAGER"],
    effectivePermissions: [
      "portal.admin.access",
      "hierarchy.read",
      "hierarchy.manage",
      "hierarchy.history.read",
      "team.direct_reports.read",
    ],
    widestScope: "ORGANIZATION",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  const employeeSession: SessionContext = {
    userId: "usr_employee",
    employeeId: "EMP-006",
    name: "Rohan Employee",
    email: "employee@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["EMPLOYEE"],
    effectivePermissions: ["portal.employee.access", "hierarchy.read"],
    widestScope: "SELF",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  const teamLeadSession: SessionContext = {
    userId: "usr_teammanager",
    employeeId: "EMP-005",
    name: "Vikram Team-Lead",
    email: "teammanager@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["TEAM_MANAGER"],
    effectivePermissions: [
      "portal.employee.access",
      "hierarchy.read",
      "team.direct_reports.read",
      "team.reporting_hierarchy.read",
    ],
    widestScope: "DIRECT_REPORTS",
    managedDepartmentIds: [],
    managedTeamIds: ["team_fe"],
    directReportIds: ["EMP-006"],
    isSuperAdmin: false,
  };

  const deptScopedSession: SessionContext = {
    userId: "usr_hrexecutive",
    employeeId: "EMP-004",
    name: "Kavita HR-Executive",
    email: "hrexecutive@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["HR_EXECUTIVE"],
    effectivePermissions: ["portal.admin.access", "hierarchy.read", "team.direct_reports.read"],
    widestScope: "DEPARTMENT",
    managedDepartmentIds: ["dept_hr"],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  beforeEach(async () => {
    process.env.PAYROLL_ACTIVE_KEY_VERSION = "v1";
    process.env.PAYROLL_ENCRYPTION_KEY_V1 = "16653300a8f4b5fd31651ab5e712f66368283ea90db280042d10f382ec4af16a";
    process.env.PAYROLL_ENCRYPTION_KEY_V2 = "54abd47926e62762db1c45bac2259cd138430a1214b9d6bc2bc370512e0956e8";
    await seedDatabase();
  });

  describe("Pre-Flight Validation & Cycle Detection", () => {
    it("should reject self-reporting when an employee tries to report to themselves", async () => {
      const res1 = await validateReportingHierarchy("EMP-004", "EMP-004");
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain("SELF_REPORTING_NOT_ALLOWED");

      const emp = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-004")).limit(1);
      const res2 = await validateReportingHierarchy(emp[0].id, "EMP-004");
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain("SELF_REPORTING_NOT_ALLOWED");
    });

    it("should reject direct circular reporting (A -> B, B tries to report to A)", async () => {
      // In seed data: EMP-004 (Kavita) reports to EMP-003 (Meera)
      const res = await validateReportingHierarchy("EMP-003", "EMP-004");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("CIRCULAR_REPORTING_NOT_ALLOWED");
    });

    it("should reject indirect circular reporting across multi-level hierarchy (A -> B -> C, C tries to report to A)", async () => {
      // In seed data: EMP-001 (CEO) -> EMP-002 (Admin) -> EMP-005 (TeamLead) -> EMP-006 (Rohan)
      const res1 = await validateReportingHierarchy("EMP-001", "EMP-006");
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain("CIRCULAR_REPORTING_NOT_ALLOWED");

      const res2 = await validateReportingHierarchy("EMP-002", "EMP-006");
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain("CIRCULAR_REPORTING_NOT_ALLOWED");
    });

    it("should allow valid reporting manager assignment without cycles", async () => {
      // EMP-004 currently reports to EMP-003. Changing to EMP-002 is structurally valid
      const res = await validateReportingHierarchy("EMP-004", "EMP-002");
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("should allow assigning to null (Top of organization / CEO)", async () => {
      const res = await validateReportingHierarchy("EMP-004", null);
      expect(res.valid).toBe(true);
    });

    it("should reject assigning an inactive or terminated employee as manager", async () => {
      await db.update(employees).set({ status: "TERMINATED" }).where(eq(employees.employeeCode, "EMP-005"));

      const res = await validateReportingHierarchy("EMP-006", "EMP-005");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("INACTIVE_MANAGER");
    });

    it("should reject assignment if candidate is already the employee's current manager", async () => {
      // EMP-006 already reports to EMP-005
      const res = await validateReportingHierarchy("EMP-006", "EMP-005");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("ALREADY_ASSIGNED");
    });
  });

  describe("Hierarchy Retrieval & Traversal Operations", () => {
    it("should get direct reports of a manager", async () => {
      const reports = await getDirectReports("EMP-001", adminSession);
      const codes = reports.map((r) => r.employeeCode);
      expect(codes).toContain("EMP-002");
      expect(codes).toContain("EMP-003");
      expect(reports[0].directReportsCount).toBeGreaterThanOrEqual(1);
    });

    it("should traverse upward manager chain up to top executive", async () => {
      // EMP-006 -> EMP-005 -> EMP-002 -> EMP-001
      const chain = await getManagerChain("EMP-006", adminSession);
      expect(chain.length).toBe(3);
      expect(chain[0].employeeCode).toBe("EMP-005");
      expect(chain[0].level).toBe(1);
      expect(chain[1].employeeCode).toBe("EMP-002");
      expect(chain[1].level).toBe(2);
      expect(chain[2].employeeCode).toBe("EMP-001");
      expect(chain[2].level).toBe(3);
    });

    it("should retrieve all recursive subordinates", async () => {
      const subs = await getAllSubordinates("EMP-002", adminSession);
      const codes = subs.map((s) => s.employeeCode);
      expect(codes).toContain("EMP-005");
      expect(codes).toContain("EMP-006");
    });

    it("should build structured tree with correct depth and children", async () => {
      const tree = await getReportingHierarchy("EMP-001", adminSession, 4);
      expect(tree).not.toBeNull();
      expect(tree?.employeeCode).toBe("EMP-001");
      expect(tree?.children?.length).toBeGreaterThanOrEqual(2);

      const adminBranch = tree?.children?.find((c) => c.employeeCode === "EMP-002");
      expect(adminBranch).toBeDefined();
      expect(adminBranch?.children?.some((c) => c.employeeCode === "EMP-005")).toBe(true);
    });
  });

  describe("Atomic Manager Reassignment, Concurrency & Audit Integrity", () => {
    it("should require concurrencyVersion on every manager mutation", async () => {
      await expect(
        changeReportingManager(adminSession, "EMP-004", {
          newManagerId: "EMP-002",
          reason: "Missing version test",
          effectiveDate: "2024-05-01",
          concurrencyVersion: undefined as any,
        })
      ).rejects.toThrow(/CONCURRENCY_VERSION_REQUIRED/);
    });

    it("should reject blank or whitespace-only reason", async () => {
      const emp = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-004")).limit(1);
      await expect(
        changeReportingManager(adminSession, "EMP-004", {
          newManagerId: "EMP-002",
          reason: "   ",
          effectiveDate: "2024-05-01",
          concurrencyVersion: emp[0].concurrencyVersion,
        })
      ).rejects.toThrow(/REASON_REQUIRED/);
    });

    it("should reject future-dated manager changes", async () => {
      const emp = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-004")).limit(1);
      await expect(
        changeReportingManager(adminSession, "EMP-004", {
          newManagerId: "EMP-002",
          reason: "Future reorganization",
          effectiveDate: "2099-01-01",
          concurrencyVersion: emp[0].concurrencyVersion,
        })
      ).rejects.toThrow(/FUTURE_DATE_NOT_SUPPORTED/);
    });

    it("should reassign manager, update version, and create durable audit log inside transaction", async () => {
      const empBefore = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-004")).limit(1);
      const initialVersion = empBefore[0].concurrencyVersion;

      const result = await changeReportingManager(adminSession, "EMP-004", {
        newManagerId: "EMP-002",
        reason: "Department restructuring approved by HR Director",
        effectiveDate: "2024-05-01",
        concurrencyVersion: initialVersion,
      });

      expect(result.success).toBe(true);
      expect(result.concurrencyVersion).toBe(initialVersion + 1);

      // Verify persistence in employees table
      const empAfter = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-004")).limit(1);
      expect(empAfter[0].managerId).toBe("EMP-002");
      expect(empAfter[0].concurrencyVersion).toBe(initialVersion + 1);

      // Verify manager change history table record
      const historyRows = await db
        .select()
        .from(employeeManagerHistory)
        .where(eq(employeeManagerHistory.employeeId, empBefore[0].id));

      expect(historyRows.length).toBe(1);
      expect(historyRows[0].previousManagerId).toBe("EMP-003");
      expect(historyRows[0].newManagerId).toBe("EMP-002");

      // Verify tamper-evident audit log event
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.targetId, empBefore[0].id));
      const changeLogs = logs.filter((l) => l.action === "REPORTING_MANAGER_CHANGED");
      expect(changeLogs.length).toBe(1);

      const chainValid = verifyAuditLogChain(logs);
      expect(chainValid.valid).toBe(true);
    });

    it("should reject concurrent manager updates with stale concurrencyVersion", async () => {
      const empBefore = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-004")).limit(1);
      const version = empBefore[0].concurrencyVersion;

      // First successful update
      await changeReportingManager(adminSession, "EMP-004", {
        newManagerId: "EMP-001",
        reason: "Update 1",
        effectiveDate: "2024-05-01",
        concurrencyVersion: version,
      });

      // Second update using same stale version must fail
      await expect(
        changeReportingManager(adminSession, "EMP-004", {
          newManagerId: "EMP-002",
          reason: "Concurrent Stale Update",
          effectiveDate: "2024-05-01",
          concurrencyVersion: version,
        })
      ).rejects.toThrow(/CONCURRENCY_CONFLICT/);
    });

    it("should handle simultaneous competing writes where only one succeeds", async () => {
      const empBefore = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-004")).limit(1);
      const version = empBefore[0].concurrencyVersion;

      const p1 = changeReportingManager(adminSession, "EMP-004", {
        newManagerId: "EMP-001",
        reason: "Simultaneous write A",
        effectiveDate: "2024-05-01",
        concurrencyVersion: version,
      });

      const p2 = changeReportingManager(adminSession, "EMP-004", {
        newManagerId: "EMP-002",
        reason: "Simultaneous write B",
        effectiveDate: "2024-05-01",
        concurrencyVersion: version,
      });

      const results = await Promise.allSettled([p1, p2]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      if (rejected[0].status === "rejected") {
        expect(rejected[0].reason.message).toContain("CONCURRENCY_CONFLICT");
      }
    });

    it("should rollback database transaction completely if audit logging fails", async () => {
      const empBefore = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-005")).limit(1);
      const version = empBefore[0].concurrencyVersion;
      const originalManager = empBefore[0].managerId;

      await expect(
        changeReportingManager(
          adminSession,
          "EMP-005",
          {
            newManagerId: "EMP-001",
            reason: "Audit failure test",
            effectiveDate: "2024-05-01",
            concurrencyVersion: version,
          },
          { _injectAuditFailure: true } as any
        )
      ).rejects.toThrow(/AUDIT_STORAGE_CRITICAL_FAILURE/);

      // Verify that rollback occurred: manager and version must be UNCHANGED
      const empAfter = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-005")).limit(1);
      expect(empAfter[0].managerId).toBe(originalManager);
      expect(empAfter[0].concurrencyVersion).toBe(version);
    });

    it("should recompute reportingHierarchy cache for all downstream descendants", async () => {
      // In seed data: EMP-002 -> EMP-005 -> EMP-006
      // Initially, EMP-006's hierarchy contains EMP-005, EMP-002, EMP-001
      const emp5Before = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-005")).limit(1);

      // Reassign EMP-005 to report directly to EMP-003 (Meera) instead of EMP-002
      await changeReportingManager(adminSession, "EMP-005", {
        newManagerId: "EMP-003",
        reason: "Move engineering team to HR Ops reporting",
        effectiveDate: "2024-05-01",
        concurrencyVersion: emp5Before[0].concurrencyVersion,
      });

      // Verify EMP-005's new hierarchy
      const emp5After = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-005")).limit(1);
      expect(emp5After[0].managerId).toBe("EMP-003");
      const h5 = JSON.parse(emp5After[0].reportingHierarchy);
      expect(h5).toContain("EMP-003");
      expect(h5).not.toContain("EMP-002");

      // Verify downstream descendant EMP-006's reportingHierarchy was automatically recomputed!
      const emp6After = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-006")).limit(1);
      const h6 = JSON.parse(emp6After[0].reportingHierarchy);
      expect(h6).toContain("EMP-005");
      expect(h6).toContain("EMP-003");
      expect(h6).not.toContain("EMP-002");
    });
  });

  describe("Server-Side Scope & Permission Enforcement", () => {
    it("should allow TEAM_MANAGER with DIRECT_REPORTS scope to view their direct reports", async () => {
      const reports = await getDirectReports("EMP-005", teamLeadSession);
      expect(reports.length).toBeGreaterThanOrEqual(1);
      expect(reports.some((r) => r.employeeCode === "EMP-006")).toBe(true);
    });

    it("should reject TEAM_MANAGER with DIRECT_REPORTS scope from viewing other managers direct reports", async () => {
      await expect(getDirectReports("EMP-001", teamLeadSession)).rejects.toThrow(/UNAUTHORIZED_SCOPE/);
    });

    it("should reject HR_EXECUTIVE with DEPARTMENT scope from accessing cross-department hierarchy", async () => {
      // Kavita is in dept_hr. Trying to view Vikram in dept_eng must fail
      await expect(getManagerChain("EMP-005", deptScopedSession)).rejects.toThrow(/UNAUTHORIZED_SCOPE/);
    });

    it("should allow HR_EXECUTIVE with DEPARTMENT scope to view department colleague manager chain", async () => {
      // Meera is in dept_hr
      const chain = await getManagerChain("EMP-003", deptScopedSession);
      expect(chain.length).toBeGreaterThanOrEqual(1);
    });

    it("should reject an Employee in SELF scope from viewing another employee manager history", async () => {
      await expect(getManagerHistory("EMP-001", employeeSession)).rejects.toThrow(/UNAUTHORIZED/);
    });
  });
});
