import { describe, it, expect, beforeEach } from "vitest";
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

  beforeEach(async () => {
    process.env.PAYROLL_ACTIVE_KEY_VERSION = "v1";
    process.env.PAYROLL_ENCRYPTION_KEY_V1 = "16653300a8f4b5fd31651ab5e712f66368283ea90db280042d10f382ec4af16a";
    process.env.PAYROLL_ENCRYPTION_KEY_V2 = "54abd47926e62762db1c45bac2259cd138430a1214b9d6bc2bc370512e0956e8";
    await seedDatabase();
  });

  describe("Pre-Flight Validation & Cycle Detection", () => {
    it("should reject self-reporting when an employee tries to report to themselves", async () => {
      // Direct self-reporting by code
      const res1 = await validateReportingHierarchy("EMP-004", "EMP-004");
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain("SELF_REPORTING_NOT_ALLOWED");

      // By UUID / Code mix
      const emp = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-004")).limit(1);
      const res2 = await validateReportingHierarchy(emp[0].id, "EMP-004");
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain("SELF_REPORTING_NOT_ALLOWED");
    });

    it("should reject direct circular reporting (A -> B, B tries to report to A)", async () => {
      // In seed data: EMP-004 (Kavita) reports to EMP-003 (Meera)
      // Setting EMP-003's manager to EMP-004 must be blocked!
      const cycleCheck = await validateReportingHierarchy("EMP-003", "EMP-004");
      expect(cycleCheck.valid).toBe(false);
      expect(cycleCheck.error).toContain("CIRCULAR_REPORTING_NOT_ALLOWED");
    });

    it("should reject indirect circular reporting across multi-level hierarchy (A -> B -> C, C tries to report to A)", async () => {
      // In seed data: EMP-006 (Rohan) reports to EMP-005 (Vikram), EMP-005 reports to EMP-002 (Aakash), EMP-002 reports to EMP-001 (Siddharth)
      // Making EMP-001 report to EMP-006 must be detected and blocked!
      const indirectCycle = await validateReportingHierarchy("EMP-001", "EMP-006");
      expect(indirectCycle.valid).toBe(false);
      expect(indirectCycle.error).toContain("CIRCULAR_REPORTING_NOT_ALLOWED");
    });

    it("should allow valid reporting manager assignment without cycles", async () => {
      // EMP-006 (Rohan) reporting directly to EMP-001 (CEO Siddharth) is valid
      const validCheck = await validateReportingHierarchy("EMP-006", "EMP-001");
      expect(validCheck.valid).toBe(true);
      expect(validCheck.error).toBeUndefined();
    });

    it("should allow setting manager to null for top-level executives", async () => {
      const topLevelCheck = await validateReportingHierarchy("EMP-002", null);
      expect(topLevelCheck.valid).toBe(true);
    });

    it("should reject candidate managers who are in TERMINATED or SUSPENDED status", async () => {
      // Suspend an employee (EMP-005)
      await db.update(employees).set({ status: "SUSPENDED" }).where(eq(employees.employeeCode, "EMP-005"));

      // In seed data: EMP-004 reports to EMP-003. Setting manager to suspended EMP-005 must fail with INACTIVE_MANAGER
      const res = await validateReportingHierarchy("EMP-004", "EMP-005");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("INACTIVE_MANAGER");
    });
  });

  describe("Hierarchy Traversal: Upward Chain & Downward Subordinates", () => {
    it("should compute accurate upward manager chain from employee to top of organization", async () => {
      // EMP-006 (Rohan) -> EMP-005 (Vikram) -> EMP-002 (Aakash) -> EMP-001 (Siddharth)
      const chain = await getManagerChain("EMP-006");
      expect(chain.length).toBe(3);

      expect(chain[0].employeeCode).toBe("EMP-005"); // Direct Manager
      expect(chain[0].level).toBe(1);

      expect(chain[1].employeeCode).toBe("EMP-002"); // Skip Manager
      expect(chain[1].level).toBe(2);

      expect(chain[2].employeeCode).toBe("EMP-001"); // CEO
      expect(chain[2].level).toBe(3);
    });

    it("should return empty upward chain for top-level executive", async () => {
      const topChain = await getManagerChain("EMP-001");
      expect(topChain.length).toBe(0);
    });

    it("should retrieve all direct reports for a manager", async () => {
      // EMP-001 has direct reports: EMP-002 (Aakash), EMP-003 (Meera), EMP-007 (Ananya)
      const directReports = await getDirectReports("EMP-001", adminSession);
      expect(directReports.length).toBe(3);

      const codes = directReports.map((d) => d.employeeCode);
      expect(codes).toContain("EMP-002");
      expect(codes).toContain("EMP-003");
      expect(codes).toContain("EMP-007");

      for (const rep of directReports) {
        expect(rep.depth).toBe(1);
        expect(rep.name).toBeDefined();
      }
    });

    it("should traverse downward and gather all direct and indirect subordinates", async () => {
      // Subordinates under EMP-002 (Aakash): EMP-005 (Vikram) and EMP-006 (Rohan)
      const allSubs = await getAllSubordinates("EMP-002", adminSession);
      expect(allSubs.length).toBe(2);

      const subCodes = allSubs.map((s) => s.employeeCode);
      expect(subCodes).toContain("EMP-005");
      expect(subCodes).toContain("EMP-006");
    });

    it("should build nested hierarchical tree structure", async () => {
      const tree = await getReportingHierarchy("EMP-001", adminSession, 4);
      expect(tree).not.toBeNull();
      expect(tree?.employeeCode).toBe("EMP-001");
      expect(tree?.directReportsCount).toBe(3);
      expect(tree?.children?.length).toBe(3);
    });
  });

  describe("Reporting Manager Changes & Optimistic Concurrency", () => {
    it("should execute transactional reporting manager change and update concurrencyVersion", async () => {
      const empBefore = await db.select().from(employees).where(eq(employees.employeeCode, "EMP-004")).limit(1);
      const initialVersion = empBefore[0].concurrencyVersion;

      // Reassign EMP-004 (Kavita) to report to EMP-002 (Aakash)
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
      expect(historyRows[0].reason).toBe("Department restructuring approved by HR Director");
      expect(historyRows[0].effectiveDate).toBe("2024-05-01");

      // Verify tamper-evident audit log event
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.targetId, empBefore[0].id));

      const changeLogs = logs.filter((l) => l.action === "REPORTING_MANAGER_CHANGED");
      expect(changeLogs.length).toBe(1);
      expect(changeLogs[0].prevHash).toBeDefined();
      expect(changeLogs[0].currentHash).toBeDefined();

      // Verify audit hash chain validity
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
          concurrencyVersion: version, // Stale!
        })
      ).rejects.toThrow(/CONCURRENCY_CONFLICT/);
    });

    it("should reject manager changes from unauthorized non-admin roles", async () => {
      await expect(
        changeReportingManager(employeeSession, "EMP-004", {
          newManagerId: "EMP-001",
          reason: "Unauthorized attempt",
          effectiveDate: "2024-05-01",
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it("should reject circular manager change in changeReportingManager", async () => {
      // EMP-004 reports to EMP-003. Trying to make EMP-003 report to EMP-004 must throw
      await expect(
        changeReportingManager(adminSession, "EMP-003", {
          newManagerId: "EMP-004",
          reason: "Circular assignment",
          effectiveDate: "2024-05-01",
        })
      ).rejects.toThrow(/CIRCULAR_REPORTING_NOT_ALLOWED/);
    });
  });

  describe("Manager Change History & Scope Protection", () => {
    it("should retrieve historical manager changes enriched with names", async () => {
      await changeReportingManager(adminSession, "EMP-004", {
        newManagerId: "EMP-001",
        reason: "Reporting directly to CEO",
        effectiveDate: "2024-06-01",
      });

      const history = await getManagerHistory("EMP-004", adminSession);
      expect(history.length).toBe(1);
      expect(history[0].previousManagerName).toBe("Meera HR-Manager");
      expect(history[0].newManagerName).toBe("Siddharth SuperAdmin");
      expect(history[0].reason).toBe("Reporting directly to CEO");
    });

    it("should prevent an Employee in SELF scope from viewing another employee's manager history", async () => {
      await expect(getManagerHistory("EMP-001", employeeSession)).rejects.toThrow(/Unauthorized/);
    });
  });
});
