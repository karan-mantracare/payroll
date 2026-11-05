import { describe, it, expect } from "vitest";
import { redactSensitiveDetails, RawSensitiveEmployee } from "../src/lib/permissions/redactor";
import { SessionContext } from "../src/lib/permissions/types";

describe("Field-Level Sensitive Data Redaction Engine", () => {
  const sampleDetails: RawSensitiveEmployee = {
    id: "sens_1",
    employeeId: "EMP-006",
    basicSalary: 120000,
    grossSalary: 145000,
    netSalary: 115000,
    bankName: "HDFC Bank",
    bankAccountNumber: "987654321006",
    bankIfsc: "HDFC0001234",
    taxIdentifier: "AAAPL0006R",
    identityDocumentNumber: "IND-ID-99901",
    identityDocumentUrl: "https://secure.mantracare.com/docs/passport.pdf",
  };

  it("should redact all financial and identity fields when caller lacks sensitive permissions", () => {
    const unprivilegedSession: SessionContext = {
      userId: "usr_viewer",
      name: "Viewer",
      email: "v@mc.com",
      organizationId: "org_1",
      roles: ["EMPLOYEE"],
      effectivePermissions: ["dash.profile.view"],
      widestScope: "SELF",
      managedDepartmentIds: [],
      managedTeamIds: [],
      directReportIds: [],
      isSuperAdmin: false,
    };

    const redacted = redactSensitiveDetails(sampleDetails, unprivilegedSession);

    // Salary fields redacted
    expect(redacted.basicSalary).toBe("••••••••");
    expect(redacted.grossSalary).toBe("••••••••");
    expect(redacted.netSalary).toBe("••••••••");

    // Bank account masked to last 4 digits
    expect(redacted.bankAccountNumber).toBe("•••• 1006");
    expect(redacted.bankName).toBe("••••••••");
    expect(redacted.bankIfsc).toBe("••••••••");

    // Tax PAN redacted
    expect(redacted.taxIdentifier).toBe("••••••••");

    // Document URL restricted
    expect(redacted.identityDocumentUrl).toBe("[RESTRICTED]");
  });

  it("should unmask salary fields when caller holds sensitive.salary.read", () => {
    const payrollSession: SessionContext = {
      userId: "usr_payroll",
      name: "Payroll Officer",
      email: "pay@mc.com",
      organizationId: "org_1",
      roles: ["HR_MANAGER"],
      effectivePermissions: ["sensitive.salary.read"],
      widestScope: "ORGANIZATION",
      managedDepartmentIds: [],
      managedTeamIds: [],
      directReportIds: [],
      isSuperAdmin: false,
    };

    const result = redactSensitiveDetails(sampleDetails, payrollSession);

    expect(result.basicSalary).toBe(120000);
    expect(result.grossSalary).toBe(145000);
    expect(result.netSalary).toBe(115000);

    // Bank still masked because sensitive.bank.read was not granted
    expect(result.bankAccountNumber).toBe("•••• 1006");
  });

  it("should unmask all sensitive fields for Super Admin", () => {
    const superAdminSession: SessionContext = {
      userId: "usr_sa",
      name: "SuperAdmin",
      email: "sa@mc.com",
      organizationId: "org_1",
      roles: ["SUPER_ADMIN"],
      effectivePermissions: [],
      widestScope: "ORGANIZATION",
      managedDepartmentIds: [],
      managedTeamIds: [],
      directReportIds: [],
      isSuperAdmin: true,
    };

    const result = redactSensitiveDetails(sampleDetails, superAdminSession);

    expect(result.basicSalary).toBe(120000);
    expect(result.bankAccountNumber).toBe("987654321006");
    expect(result.taxIdentifier).toBe("AAAPL0006R");
    expect(result.identityDocumentUrl).toBe("https://secure.mantracare.com/docs/passport.pdf");
  });
});
