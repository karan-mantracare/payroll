import { describe, it, expect, beforeEach } from "vitest";
import { seedDatabase } from "../src/lib/db/seed";
import { db } from "../src/lib/db/client";
import { auditLogs } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateEmployeeCsv, sanitizeCsvCell } from "../src/lib/export/csv";
import { SessionContext } from "../src/lib/permissions/types";

describe("Phase 2C — Employee CSV Data Export & Injection Protection", () => {
  const superAdminSession: SessionContext = {
    userId: "usr_superadmin",
    employeeId: "EMP-001",
    name: "Siddharth SuperAdmin",
    email: "superadmin@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["SUPER_ADMIN"],
    effectivePermissions: [
      "portal.admin.access",
      "sensitive.salary.read",
      "sensitive.bank.read",
      "sensitive.tax.read",
    ],
    widestScope: "ORGANIZATION",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: true,
  };

  const hrManagerSession: SessionContext = {
    userId: "usr_hrmanager",
    employeeId: "EMP-003",
    name: "Meera HR-Manager",
    email: "hrmanager@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["HR_MANAGER"],
    effectivePermissions: ["portal.admin.access", "sensitive.salary.read"],
    widestScope: "ORGANIZATION",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  const deptScopedSession: SessionContext = {
    userId: "usr_hrexecutive",
    employeeId: "EMP-004",
    name: "Kavita HR-Executive",
    email: "hrexecutive@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["HR_EXECUTIVE"],
    effectivePermissions: ["portal.admin.access"],
    widestScope: "DEPARTMENT",
    managedDepartmentIds: ["dept_hr"],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  const regularEmployeeSession: SessionContext = {
    userId: "usr_employee",
    employeeId: "EMP-006",
    name: "Rohan Employee",
    email: "employee@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["EMPLOYEE"],
    effectivePermissions: ["portal.employee.access"],
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

  describe("CSV Formula Injection Protection (CWE-1236)", () => {
    it("should escape formula trigger characters (=, +, -, @, \\t, \\r) by prepending a single quote", () => {
      expect(sanitizeCsvCell("=1+1")).toBe("'=1+1");
      expect(sanitizeCsvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
      expect(sanitizeCsvCell("-SUM(A1:A10)")).toBe("'-SUM(A1:A10)");
      expect(sanitizeCsvCell("@SUM(A1:B10)")).toBe("'@SUM(A1:B10)");
      expect(sanitizeCsvCell("\tmalicious")).toBe("'\tmalicious");
    });

    it("should correctly escape quotes, commas, and newlines per RFC 4180", () => {
      expect(sanitizeCsvCell('Hello, "World"')).toBe('"Hello, ""World"""');
      expect(sanitizeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
      expect(sanitizeCsvCell("SimpleSafeText")).toBe("SimpleSafeText");
    });
  });

  describe("Scope Enforcement & Column Masking", () => {
    it("should export full organization for SuperAdmin including sensitive columns", async () => {
      const csv = await generateEmployeeCsv(superAdminSession);
      const lines = csv.split("\r\n");

      // Verify header contains financial fields
      expect(lines[0]).toContain("Basic Salary");
      expect(lines[0]).toContain("Bank Account Number");
      expect(lines[0]).toContain("Tax ID / PAN");

      // Verify records are included
      expect(lines.length).toBeGreaterThanOrEqual(6);
      expect(csv).toContain("EMP-001");
      expect(csv).toContain("EMP-006");
    });

    it("should restrict exported records to caller's DEPARTMENT scope", async () => {
      const csv = await generateEmployeeCsv(deptScopedSession);
      const lines = csv.split("\r\n");

      // Header should NOT include sensitive financial columns because Kavita has no sensitive permissions
      expect(lines[0]).not.toContain("Basic Salary");
      expect(lines[0]).not.toContain("Bank Account Number");

      // Only HR department employees should be present (EMP-001, EMP-003, EMP-004)
      expect(csv).toContain("EMP-004");
      // Engineering employees (EMP-005, EMP-006) must NOT appear
      expect(csv).not.toContain("EMP-006");
    });

    it("should log EMPLOYEE_DATA_EXPORTED audit record", async () => {
      await generateEmployeeCsv(superAdminSession);
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "EMPLOYEE_DATA_EXPORTED"));
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].targetEntity).toBe("employees");
    });
  });
});
