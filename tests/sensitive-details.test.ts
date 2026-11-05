import { describe, it, expect, beforeEach } from "vitest";
import { seedDatabase } from "../src/lib/db/seed";
import { db } from "../src/lib/db/client";
import { sensitiveEmployeeDetails, auditLogs } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getSensitiveDetails,
  updateSensitiveDetails,
} from "../src/lib/sensitive/service";
import { SessionContext } from "../src/lib/permissions/types";
import { decryptField } from "../src/lib/security/crypto";

describe("Phase 2C — Sensitive Financial & Identity Encryption Engine", () => {
  const financeAdminSession: SessionContext = {
    userId: "usr_finance",
    employeeId: "EMP-007",
    name: "Farhan Finance",
    email: "finance@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["FINANCE_ADMIN"],
    effectivePermissions: [
      "portal.admin.access",
      "sensitive.salary.read",
      "sensitive.salary.manage",
      "sensitive.bank.read",
      "sensitive.bank.manage",
      "sensitive.tax.read",
      "sensitive.tax.manage",
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
      "sensitive.salary.read",
      "sensitive.salary.manage",
      "sensitive.identity.read",
      "sensitive.identity.manage",
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
    effectivePermissions: ["portal.employee.access"],
    widestScope: "SELF",
    managedDepartmentIds: [],
    managedTeamIds: [],
    directReportIds: [],
    isSuperAdmin: false,
  };

  const unauthorizedSession: SessionContext = {
    userId: "usr_auditor",
    employeeId: "EMP-008",
    name: "Anil Auditor",
    email: "auditor@mantracare.com",
    organizationId: "org_mc_global",
    roles: ["COMPLIANCE_AUDITOR"],
    effectivePermissions: ["portal.admin.access"],
    widestScope: "ORGANIZATION",
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

  describe("Field-Level Decryption & Masking", () => {
    it("should decrypt and return unmasked financial details for authorized Finance Admin", async () => {
      const details = await getSensitiveDetails(financeAdminSession, "EMP-004");
      expect(details).not.toBeNull();
      if (!details) return;

      expect(typeof details.basicSalary).toBe("number");
      expect(details.basicSalary).toBe(85000);
      expect(details.bankAccountNumber).toBe("987654321004");
      expect(details.bankName).toBe("HDFC Bank");
      expect(details.taxIdentifier).toBe("AAAPL0004K");
    });

    it("should mask salary and bank details when caller lacks sensitive read permissions", async () => {
      const details = await getSensitiveDetails(unauthorizedSession, "EMP-004");
      expect(details).not.toBeNull();
      if (!details) return;

      expect(details.basicSalary).toBe("••••••••");
      expect(details.grossSalary).toBe("••••••••");
      expect(details.bankAccountNumber).toBe("•••• 1004");
      expect(details.taxIdentifier).toBe("•••• 004K");
      expect(details.bankName).toBe("••••••••");
    });

    it("should log SENSITIVE_DATA_ACCESSED audit record on every sensitive read", async () => {
      await getSensitiveDetails(financeAdminSession, "EMP-004");
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "SENSITIVE_DATA_ACCESSED"));
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((l) => l.targetEntity === "sensitive_employee_details")).toBe(true);
    });
  });

  describe("Sensitive Updates & Concurrency Control", () => {
    it("should update financial details with AES-256-GCM encryption and active key version", async () => {
      const before = await getSensitiveDetails(financeAdminSession, "EMP-004");
      expect(before).not.toBeNull();
      if (!before) return;

      const updateRes = await updateSensitiveDetails(financeAdminSession, "EMP-004", {
        basicSalary: 95000,
        grossSalary: 115000,
        bankAccountNumber: "112233445566",
        bankName: "State Bank of India",
        expectedUpdatedAt: before.updatedAt,
      });

      expect(updateRes.success).toBe(true);

      // Verify raw storage in Turso is encrypted
      const rawRows = await db
        .select()
        .from(sensitiveEmployeeDetails)
        .where(eq(sensitiveEmployeeDetails.employeeId, "EMP-004"));

      expect(rawRows[0].basicSalaryEncrypted.startsWith("v1:")).toBe(true);
      expect(decryptField(rawRows[0].basicSalaryEncrypted)).toBe("95000");
      expect(decryptField(rawRows[0].bankAccountNumberEncrypted)).toBe("112233445566");
      expect(rawRows[0].bankName).toBe("State Bank of India");

      // Verify audit event
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "SENSITIVE_DATA_UPDATED"));
      expect(logs.length).toBeGreaterThan(0);
    });

    it("should reject concurrent writes if expectedUpdatedAt does not match", async () => {
      const before = await getSensitiveDetails(financeAdminSession, "EMP-004");
      expect(before).not.toBeNull();
      if (!before) return;

      await expect(
        updateSensitiveDetails(financeAdminSession, "EMP-004", {
          basicSalary: 120000,
          expectedUpdatedAt: before.updatedAt - 99999, // Stale timestamp
        })
      ).rejects.toThrow(/CONCURRENCY_CONFLICT/);
    });

    it("should reject updates from unauthorized roles", async () => {
      await expect(
        updateSensitiveDetails(unauthorizedSession, "EMP-004", {
          basicSalary: 150000,
        })
      ).rejects.toThrow(/UNAUTHORIZED/);
    });
  });
});
