import { db } from "../db/client";
import { sensitiveEmployeeDetails, employees } from "../db/schema";
import { eq, or, and } from "drizzle-orm";
import { SessionContext, SENSITIVE_PERMISSIONS } from "../permissions/types";
import { hasPermission } from "../permissions/evaluator";
import { encryptField, decryptField, getActiveKeyVersion } from "../security/crypto";
import { auditLogger } from "../audit/logger";
import { resolveEmployee, verifyHierarchyScopeAccess } from "../hierarchy/service";

export interface UpdateSensitiveDetailsInput {
  basicSalary?: number;
  grossSalary?: number;
  netSalary?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  accountHolderName?: string;
  taxIdentifier?: string;
  identityDocumentNumber?: string;
  identityDocumentUrl?: string;
  compensationEffectiveDate?: string;
  expectedUpdatedAt?: number;
}

/**
 * Retrieves sensitive financial and identity details for an employee, applying
 * field-level access control, data masking, and access audit logging.
 */
export async function getSensitiveDetails(
  session: SessionContext,
  employeeIdOrCode: string,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const employee = await resolveEmployee(employeeIdOrCode);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Target employee record not found.");
  }

  // Validate scope: ensure employee is in caller's authorized scope
  await verifyHierarchyScopeAccess(session, employee);

  const rows = await db
    .select()
    .from(sensitiveEmployeeDetails)
    .where(
      or(
        eq(sensitiveEmployeeDetails.employeeId, employee.id),
        eq(sensitiveEmployeeDetails.employeeId, employee.employeeCode)
      )
    )
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  // Decrypt reversible encrypted fields
  const basicSalary = row.basicSalaryEncrypted ? parseFloat(decryptField(row.basicSalaryEncrypted)) : 0;
  const grossSalary = row.grossSalaryEncrypted ? parseFloat(decryptField(row.grossSalaryEncrypted)) : 0;
  const netSalary = row.netSalaryEncrypted ? parseFloat(decryptField(row.netSalaryEncrypted)) : 0;
  const bankAccountNumber = row.bankAccountNumberEncrypted ? decryptField(row.bankAccountNumberEncrypted) : "";
  const bankIfsc = row.bankIfscEncrypted ? decryptField(row.bankIfscEncrypted) : "";
  const accountHolderName = row.accountHolderNameEncrypted ? decryptField(row.accountHolderNameEncrypted) : "";
  const taxIdentifier = row.taxIdentifierEncrypted ? decryptField(row.taxIdentifierEncrypted) : "";
  const identityDocNum = row.identityDocumentNumberEncrypted ? decryptField(row.identityDocumentNumberEncrypted) : "";
  const identityDocUrl = row.identityDocumentUrlEncrypted ? decryptField(row.identityDocumentUrlEncrypted) : "";

  // Evaluate granular field-level permissions
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

  const canReadIdentity =
    session.isSuperAdmin ||
    hasPermission(session, SENSITIVE_PERMISSIONS.IDENTITY_READ) ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("HR_MANAGER");

  // Audit access
  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "SENSITIVE_DATA_ACCESSED",
    targetEntity: "sensitive_employee_details",
    targetId: row.id,
    changes: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      permissions: {
        canReadSalary,
        canReadBank,
        canReadTax,
        canReadIdentity,
      },
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    id: row.id,
    employeeId: row.employeeId,
    keyVersion: row.keyVersion,
    bankName: canReadBank ? row.bankName : "••••••••",
    bankAccountNumber: canReadBank
      ? bankAccountNumber
      : `•••• ${bankAccountNumber.slice(-4) || "••••"}`,
    bankIfsc: canReadBank ? bankIfsc : "••••••••",
    accountHolderName: canReadBank
      ? (accountHolderName || employee.name)
      : `•••• ${employee.name.split(" ")[0]}`,
    basicSalary: canReadSalary ? basicSalary : "••••••••",
    grossSalary: canReadSalary ? grossSalary : "••••••••",
    netSalary: canReadSalary ? netSalary : "••••••••",
    taxIdentifier: canReadTax
      ? taxIdentifier
      : `•••• ${taxIdentifier.slice(-4) || "••••"}`,
    identityDocumentNumber: canReadIdentity
      ? identityDocNum
      : `•••• ${identityDocNum.slice(-4) || "••••"}`,
    identityDocumentUrl: canReadIdentity ? identityDocUrl : "[RESTRICTED]",
    compensationEffectiveDate: row.compensationEffectiveDate,
    updatedAt: row.updatedAt,
  };
}

/**
 * Updates an employee's sensitive financial and identity records.
 * Encrypts fields with AES-256-GCM and enforces optimistic concurrency control.
 */
export async function updateSensitiveDetails(
  session: SessionContext,
  employeeIdOrCode: string,
  input: UpdateSensitiveDetailsInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const canManage =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("FINANCE_ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("sensitive.salary.manage") ||
    session.effectivePermissions.includes("sensitive.bank.manage");

  if (!canManage) {
    throw new Error("UNAUTHORIZED: Insufficient permissions to modify sensitive compensation or banking details.");
  }

  const employee = await resolveEmployee(employeeIdOrCode);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Target employee record not found.");
  }
  await verifyHierarchyScopeAccess(session, employee);

  const existingRows = await db
    .select()
    .from(sensitiveEmployeeDetails)
    .where(
      or(
        eq(sensitiveEmployeeDetails.employeeId, employee.id),
        eq(sensitiveEmployeeDetails.employeeId, employee.employeeCode)
      )
    )
    .limit(1);

  if (existingRows.length === 0) {
    throw new Error("SENSITIVE_RECORD_NOT_FOUND: Sensitive details record not found for employee.");
  }

  const existing = existingRows[0];

  // Optimistic concurrency control
  if (input.expectedUpdatedAt && existing.updatedAt !== input.expectedUpdatedAt) {
    throw new Error(
      `CONCURRENCY_CONFLICT: Sensitive record was updated concurrently. Expected updatedAt ${input.expectedUpdatedAt}, found ${existing.updatedAt}.`
    );
  }

  const activeKeyVersion = getActiveKeyVersion();
  const now = Date.now();

  const updates: Record<string, any> = {
    updatedAt: now,
    keyVersion: activeKeyVersion,
  };

  const auditChanges: Record<string, any> = {};

  if (input.basicSalary !== undefined) {
    updates.basicSalaryEncrypted = encryptField(input.basicSalary.toString());
    auditChanges.basicSalary = "[ENCRYPTED_UPDATED]";
  }
  if (input.grossSalary !== undefined) {
    updates.grossSalaryEncrypted = encryptField(input.grossSalary.toString());
    auditChanges.grossSalary = "[ENCRYPTED_UPDATED]";
  }
  if (input.netSalary !== undefined) {
    updates.netSalaryEncrypted = encryptField(input.netSalary.toString());
    auditChanges.netSalary = "[ENCRYPTED_UPDATED]";
  }
  if (input.bankName !== undefined) {
    updates.bankName = input.bankName;
    auditChanges.bankName = input.bankName;
  }
  if (input.bankAccountNumber !== undefined) {
    updates.bankAccountNumberEncrypted = encryptField(input.bankAccountNumber);
    auditChanges.bankAccountNumber = `•••• ${input.bankAccountNumber.slice(-4)}`;
  }
  if (input.bankIfsc !== undefined) {
    updates.bankIfscEncrypted = encryptField(input.bankIfsc);
    auditChanges.bankIfsc = input.bankIfsc;
  }
  if (input.accountHolderName !== undefined) {
    updates.accountHolderNameEncrypted = encryptField(input.accountHolderName);
    auditChanges.accountHolderName = input.accountHolderName;
  }
  if (input.taxIdentifier !== undefined) {
    updates.taxIdentifierEncrypted = encryptField(input.taxIdentifier);
    auditChanges.taxIdentifier = `•••• ${input.taxIdentifier.slice(-4)}`;
  }
  if (input.identityDocumentNumber !== undefined) {
    updates.identityDocumentNumberEncrypted = encryptField(input.identityDocumentNumber);
    auditChanges.identityDocumentNumber = `•••• ${input.identityDocumentNumber.slice(-4)}`;
  }
  if (input.compensationEffectiveDate !== undefined) {
    updates.compensationEffectiveDate = input.compensationEffectiveDate;
    auditChanges.compensationEffectiveDate = input.compensationEffectiveDate;
  }

  await db
    .update(sensitiveEmployeeDetails)
    .set(updates)
    .where(eq(sensitiveEmployeeDetails.id, existing.id));

  // Durable audit logging
  await auditLogger.logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "SENSITIVE_DATA_UPDATED",
    targetEntity: "sensitive_employee_details",
    targetId: existing.id,
    changes: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      ...auditChanges,
      keyVersion: activeKeyVersion,
      updatedAt: now,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    success: true,
    id: existing.id,
    updatedAt: now,
    keyVersion: activeKeyVersion,
  };
}
