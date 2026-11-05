import { SessionContext, SENSITIVE_PERMISSIONS } from "../permissions/types";
import { hasPermission } from "../permissions/evaluator";
import { getScopedEmployees } from "../scope/service";
import { sensitiveEmployeeDetails } from "../db/schema";
import { db } from "../db/client";
import { inArray } from "drizzle-orm";
import { decryptField } from "../security/crypto";
import { auditLogger } from "../audit/logger";

/**
 * Sanitizes a cell value to prevent CSV Formula Injection (CWE-1236).
 * Any cell value starting with '=', '+', '-', '@', '\t', or '\r' is prefixed with a single quote.
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value);

  // If string starts with formula triggers, prepend a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 escaping: wrap in quotes if it contains commas, double-quotes, or newlines
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export interface CsvExportOptions {
  includeSensitiveFinancials?: boolean;
  filterDepartmentId?: string;
  filterStatus?: string;
}

/**
 * Generates an RFC-4180 compliant, injection-safe CSV export of employee records
 * within the caller's permitted data scope and field-level permission boundaries.
 */
export async function generateEmployeeCsv(
  session: SessionContext,
  options: CsvExportOptions = {},
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<string> {
  // 1. Fetch employees accessible under caller's scope
  let employeesList = await getScopedEmployees(session);

  // Apply optional filters
  if (options.filterDepartmentId) {
    employeesList = employeesList.filter((e) => (e as any).departmentId === options.filterDepartmentId);
  }
  if (options.filterStatus) {
    employeesList = employeesList.filter((e) => e.status === options.filterStatus);
  }

  // 2. Determine field-level export permissions
  const canReadSalary =
    session.isSuperAdmin ||
    hasPermission(session, SENSITIVE_PERMISSIONS.SALARY_READ) ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("FINANCE_ADMIN");

  const canReadBank =
    session.isSuperAdmin ||
    hasPermission(session, SENSITIVE_PERMISSIONS.BANK_READ) ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("FINANCE_ADMIN");

  const canReadTax =
    session.isSuperAdmin ||
    hasPermission(session, SENSITIVE_PERMISSIONS.TAX_READ) ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("FINANCE_ADMIN");

  // Fetch sensitive records if requested and authorized
  const empIds = employeesList.map((e) => e.id);
  const sensitiveMap = new Map<string, any>();

  if (empIds.length > 0 && (canReadSalary || canReadBank || canReadTax)) {
    const sensRows = await db
      .select()
      .from(sensitiveEmployeeDetails)
      .where(inArray(sensitiveEmployeeDetails.employeeId, empIds));

    for (const row of sensRows) {
      sensitiveMap.set(row.employeeId, row);
    }
  }

  // 3. Construct CSV Header
  const headers = [
    "Employee ID",
    "Full Name",
    "Work Email",
    "Job Title",
    "Department",
    "Location",
    "Team",
    "Reporting Manager ID",
    "Status",
    "Joined Date",
  ];

  if (canReadSalary) {
    headers.push("Basic Salary", "Gross Salary", "Net Salary");
  }
  if (canReadBank) {
    headers.push("Bank Name", "Bank Account Number", "Bank IFSC");
  }
  if (canReadTax) {
    headers.push("Tax ID / PAN");
  }

  const csvRows: string[] = [headers.map(sanitizeCsvCell).join(",")];

  // 4. Construct Data Rows
  for (const emp of employeesList) {
    const rowValues: any[] = [
      emp.employeeCode || emp.id,
      emp.name,
      emp.email,
      emp.jobTitle,
      emp.departmentName || "N/A",
      emp.locationName || "N/A",
      emp.teamName || "N/A",
      emp.managerId || "N/A",
      emp.status,
      emp.joinedDate,
    ];

    const sens = sensitiveMap.get(emp.id);

    if (canReadSalary) {
      const basic = sens?.basicSalaryEncrypted ? decryptField(sens.basicSalaryEncrypted) : "";
      const gross = sens?.grossSalaryEncrypted ? decryptField(sens.grossSalaryEncrypted) : "";
      const net = sens?.netSalaryEncrypted ? decryptField(sens.netSalaryEncrypted) : "";
      rowValues.push(basic, gross, net);
    }

    if (canReadBank) {
      const bankName = sens?.bankName || "";
      const bankAcc = sens?.bankAccountNumberEncrypted ? decryptField(sens.bankAccountNumberEncrypted) : "";
      const ifsc = sens?.bankIfscEncrypted ? decryptField(sens.bankIfscEncrypted) : "";
      rowValues.push(bankName, bankAcc, ifsc);
    }

    if (canReadTax) {
      const tax = sens?.taxIdentifierEncrypted ? decryptField(sens.taxIdentifierEncrypted) : "";
      rowValues.push(tax);
    }

    csvRows.push(rowValues.map(sanitizeCsvCell).join(","));
  }

  const csvOutput = csvRows.join("\r\n");

  // 5. Append tamper-evident audit record for the data export
  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "EMPLOYEE_DATA_EXPORTED",
    targetEntity: "employees",
    targetId: `export_${Date.now()}`,
    changes: {
      exportedRowsCount: employeesList.length,
      scope: session.widestScope,
      includedSalary: canReadSalary,
      includedBank: canReadBank,
      includedTax: canReadTax,
      filters: options,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return csvOutput;
}
