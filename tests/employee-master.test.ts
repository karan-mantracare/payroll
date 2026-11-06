import { describe, it, expect, beforeEach } from "vitest";
import { seedDatabase } from "../src/lib/db/seed";
import { db, rawClient } from "../src/lib/db/client";
import {
  createEmployee,
  updateEmployee,
  transitionEmployeeStatus,
  listEmployees,
  getEmployeeDetail,
} from "../src/lib/employees/service";
import {
  generateNextEmployeeId,
  validateEmployeeId,
  getEmployeeIdConfig,
  updateEmployeeIdConfig,
} from "../src/lib/employees/id-service";
import { SessionContext } from "../src/lib/permissions/types";
import { auditLogs, employeeStatusHistory } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

describe("Phase 2A — Employee Master Management", () => {
  const adminSession: SessionContext = {
    userId: "usr_admin",
    employeeId: "EMP-002",
    name: "Aakash Admin",
    email: "admin@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["ADMIN"],
    effectivePermissions: ["portal.admin.access", "employee.create", "employee.edit", "employee.read"],
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
    effectivePermissions: ["portal.employee.access", "employee.read"],
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

  describe("Configurable Employee ID Generation & Rules", () => {
    it("should generate sequential employee IDs according to organization configuration", async () => {
      const nextId1 = await generateNextEmployeeId("org_mc_global");
      expect(nextId1).toMatch(/^EMP-\d{3}$/);

      const nextId2 = await generateNextEmployeeId("org_mc_global");
      expect(nextId2).toMatch(/^EMP-\d{3}$/);
      expect(nextId1).not.toBe(nextId2);
    });

    it("should support updating company prefix, digit padding, and suffix rules", async () => {
      await updateEmployeeIdConfig("org_mc_global", {
        prefix: "MC",
        digitCount: 4,
        nextSequence: 101,
        suffix: "-IN",
      });

      const nextCustomId = await generateNextEmployeeId("org_mc_global");
      expect(nextCustomId).toBe("MC-0101-IN");
    });

    it("should validate candidate employee IDs and reject duplicates or invalid formats", async () => {
      // Duplicate of existing EMP-001
      const dupRes = await validateEmployeeId("EMP-001");
      expect(dupRes.valid).toBe(false);
      expect(dupRes.error).toContain("already assigned");

      // Invalid format with symbols
      const invalidRes = await validateEmployeeId("EMP@#$$");
      expect(invalidRes.valid).toBe(false);

      // Unique valid manual ID
      const validRes = await validateEmployeeId("MANUAL-999");
      expect(validRes.valid).toBe(true);
    });
  });

  describe("Employee Creation & Validation", () => {
    it("should successfully create a new employee with internal UUID and auto-generated code", async () => {
      const created = await createEmployee(adminSession, {
        name: "Samantha Developer",
        email: "samantha@mantracare.com",
        departmentId: "dept_eng",
        locationId: "loc_blr",
        teamId: "team_fe",
        jobTitle: "Senior Frontend Engineer",
        employmentType: "FULL_TIME",
        probationStatus: "IN_PROBATION",
        joinedDate: "2024-03-01",
        status: "ACTIVE",
        phone: "+91 99887 76655",
      });

      expect(created.id).toMatch(/^emp_/);
      expect(created.employeeCode).toMatch(/^EMP-\d{3}$/);
      expect(created.name).toBe("Samantha Developer");

      // Verify created record exists in DB
      const detail = await getEmployeeDetail(adminSession, created.id);
      expect(detail).not.toBeNull();
      expect(detail?.email).toBe("samantha@mantracare.com");
      expect(detail?.departmentName).toBe("Engineering & Tech");
      expect(detail?.concurrencyVersion).toBe(1);

      // Verify audit log created
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.targetId, created.id));
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe("EMPLOYEE_CREATED");
    });

    it("should reject creation attempts from unauthorized roles", async () => {
      await expect(
        createEmployee(employeeSession, {
          name: "Hacker Employee",
          email: "hacker@mantracare.com",
          departmentId: "dept_eng",
          locationId: "loc_delhi",
          jobTitle: "Attacker",
          joinedDate: "2024-01-01",
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it("should reject invalid email or missing required fields via Zod validation", async () => {
      await expect(
        createEmployee(adminSession, {
          name: "J", // Too short
          email: "invalid-email-address",
          departmentId: "",
          locationId: "",
          jobTitle: "",
          joinedDate: "not-a-date",
        })
      ).rejects.toThrow();
    });
  });

  describe("Employee Retrieval & Data Scoping", () => {
    it("should resolve employee by either internal UUID or immutable employeeCode", async () => {
      const byCode = await getEmployeeDetail(adminSession, "EMP-001");
      expect(byCode).not.toBeNull();
      expect(byCode?.name).toBe("Siddharth SuperAdmin");

      const byUuid = await getEmployeeDetail(adminSession, byCode!.id);
      expect(byUuid).not.toBeNull();
      expect(byUuid?.employeeCode).toBe("EMP-001");
    });

    it("should prevent an Employee with SELF scope from viewing other employees", async () => {
      // EMP-006 can view self
      const selfRecord = await getEmployeeDetail(employeeSession, "EMP-006");
      expect(selfRecord).not.toBeNull();
      expect(selfRecord?.name).toBe("Rohan Employee");

      // EMP-006 CANNOT view EMP-001 (Siddharth SuperAdmin)
      const outOfScopeRecord = await getEmployeeDetail(employeeSession, "EMP-001");
      expect(outOfScopeRecord).toBeNull();
    });
  });

  describe("Employee Update & Optimistic Concurrency Control", () => {
    it("should successfully update permitted fields and increment concurrency version", async () => {
      const initial = await getEmployeeDetail(adminSession, "EMP-004");
      expect(initial).not.toBeNull();
      const currentVersion = initial!.concurrencyVersion;

      const updated = await updateEmployee(adminSession, "EMP-004", {
        jobTitle: "Lead Full Stack Engineer",
        phone: "+91 91234 56789",
        concurrencyVersion: currentVersion,
      });

      expect(updated.concurrencyVersion).toBe(currentVersion + 1);

      // Verify updated values persisted
      const refreshed = await getEmployeeDetail(adminSession, "EMP-004");
      expect(refreshed?.jobTitle).toBe("Lead Full Stack Engineer");
      expect(refreshed?.phone).toBe("+91 91234 56789");

      // Verify immutable employeeCode and id were NOT altered
      expect(refreshed?.employeeCode).toBe("EMP-004");
      expect(refreshed?.id).toBe(initial!.id);

      // Verify audit log
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.targetId, initial!.id));
      const updateLogs = logs.filter((l) => l.action === "EMPLOYEE_UPDATED");
      expect(updateLogs.length).toBeGreaterThan(0);
    });

    it("should reject updates with stale concurrency versions", async () => {
      const initial = await getEmployeeDetail(adminSession, "EMP-004");
      expect(initial).not.toBeNull();

      // First update advances version to 2
      await updateEmployee(adminSession, "EMP-004", {
        jobTitle: "Update 1",
        concurrencyVersion: initial!.concurrencyVersion,
      });

      // Second update using old stale version 1 must be rejected
      await expect(
        updateEmployee(adminSession, "EMP-004", {
          jobTitle: "Stale Update 2",
          concurrencyVersion: initial!.concurrencyVersion, // Stale version!
        })
      ).rejects.toThrow(/CONCURRENCY_CONFLICT/);
    });
  });

  describe("Employment Status Transitions & Audit History", () => {
    it("should transition employee status and record full transition audit history", async () => {
      const initial = await getEmployeeDetail(adminSession, "EMP-004");
      expect(initial!.status).toBe("ACTIVE");

      const transitionRes = await transitionEmployeeStatus(adminSession, "EMP-004", {
        newStatus: "ON_LEAVE",
        reason: "Approved medical leave for recovery",
        effectiveDate: "2024-04-01",
        concurrencyVersion: initial!.concurrencyVersion,
      });

      expect(transitionRes.previousStatus).toBe("ACTIVE");
      expect(transitionRes.newStatus).toBe("ON_LEAVE");

      // Verify status history table record
      const historyRows = await db
        .select()
        .from(employeeStatusHistory)
        .where(eq(employeeStatusHistory.employeeId, initial!.id));

      expect(historyRows.length).toBe(1);
      expect(historyRows[0].previousStatus).toBe("ACTIVE");
      expect(historyRows[0].newStatus).toBe("ON_LEAVE");
      expect(historyRows[0].reason).toBe("Approved medical leave for recovery");
      expect(historyRows[0].effectiveDate).toBe("2024-04-01");

      // Verify audit_logs table has status transition event
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.targetId, initial!.id));
      const statusLogs = logs.filter((l) => l.action === "EMPLOYEE_STATUS_TRANSITION");
      expect(statusLogs.length).toBe(1);
    });

    it("should reject transitioning to the already active status", async () => {
      const initial = await getEmployeeDetail(adminSession, "EMP-004");
      await expect(
        transitionEmployeeStatus(adminSession, "EMP-004", {
          newStatus: initial!.status as any,
          reason: "No change",
          effectiveDate: "2024-04-01",
          concurrencyVersion: initial!.concurrencyVersion,
        })
      ).rejects.toThrow(/already in status/);
    });
  });

  describe("Server-Side Search, Filter, Sort & Pagination", () => {
    it("should paginate employee records accurately", async () => {
      const page1 = await listEmployees(adminSession, { page: 1, pageSize: 3 });
      expect(page1.employees.length).toBe(3);
      expect(page1.total).toBeGreaterThanOrEqual(7);
      expect(page1.totalPages).toBe(Math.ceil(page1.total / 3));

      const page2 = await listEmployees(adminSession, { page: 2, pageSize: 3 });
      expect(page2.employees.length).toBe(3);
      expect(page2.employees[0].id).not.toBe(page1.employees[0].id);
    });

    it("should filter employees by department", async () => {
      const engEmployees = await listEmployees(adminSession, { departmentId: "dept_eng" });
      expect(engEmployees.employees.length).toBeGreaterThan(0);
      for (const emp of engEmployees.employees) {
        expect(emp.departmentId).toBe("dept_eng");
      }
    });

    it("should search employees by name, email, employee code, or designation", async () => {
      const searchByName = await listEmployees(adminSession, { search: "Siddharth" });
      expect(searchByName.employees.length).toBe(1);
      expect(searchByName.employees[0].name).toBe("Siddharth SuperAdmin");

      const searchByCode = await listEmployees(adminSession, { search: "EMP-003" });
      expect(searchByCode.employees.length).toBe(1);
      expect(searchByCode.employees[0].employeeCode).toBe("EMP-003");

      const searchByTitle = await listEmployees(adminSession, { search: "Frontend" });
      expect(searchByTitle.employees.length).toBe(1);
      expect(searchByTitle.employees[0].jobTitle).toContain("Frontend");
    });
  });
});
