import { db } from "../db/client";
import { employees, users, sensitiveEmployeeDetails, departments, locations, teams } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { SessionContext } from "../permissions/types";
import { buildScopeCondition } from "./filter";
import { redactSensitiveDetails, RedactedSensitiveEmployee, RawSensitiveEmployee } from "../permissions/redactor";
import { decryptField } from "../security/crypto";

export interface ScopedEmployeeRecord {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  departmentName?: string | null;
  locationName?: string | null;
  teamName?: string | null;
  managerId: string | null;
  status: string;
  joinedDate: string;
  sensitive?: RedactedSensitiveEmployee;
}

/**
 * Fetches all employees accessible under the caller's session data scope.
 */
export async function getScopedEmployees(
  session: SessionContext
): Promise<ScopedEmployeeRecord[]> {
  const scopeCondition = buildScopeCondition(session);

  const query = db
    .select({
      id: employees.id,
      name: users.name,
      email: users.email,
      jobTitle: employees.jobTitle,
      departmentName: departments.name,
      locationName: locations.name,
      teamName: teams.name,
      managerId: employees.managerId,
      status: employees.status,
      joinedDate: employees.joinedDate,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(locations, eq(employees.locationId, locations.id))
    .leftJoin(teams, eq(employees.teamId, teams.id));

  if (scopeCondition) {
    return query.where(scopeCondition);
  }

  return query;
}

/**
 * Checks whether a specific employee ID is authorized to be viewed by the caller.
 */
export async function isEmployeeInScope(
  session: SessionContext,
  targetEmployeeId: string
): Promise<boolean> {
  if (session.isSuperAdmin || session.widestScope === "ORGANIZATION") {
    return true;
  }

  const scopeCondition = buildScopeCondition(session);
  const matched = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, targetEmployeeId), scopeCondition))
    .limit(1);

  return matched.length > 0;
}

/**
 * Fetches an employee record with field-level sensitive detail redaction.
 */
export async function getScopedEmployeeById(
  session: SessionContext,
  targetEmployeeId: string
): Promise<ScopedEmployeeRecord | null> {
  const inScope = await isEmployeeInScope(session, targetEmployeeId);
  if (!inScope) {
    return null;
  }

  const records = await db
    .select({
      id: employees.id,
      name: users.name,
      email: users.email,
      jobTitle: employees.jobTitle,
      departmentName: departments.name,
      locationName: locations.name,
      teamName: teams.name,
      managerId: employees.managerId,
      status: employees.status,
      joinedDate: employees.joinedDate,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(locations, eq(employees.locationId, locations.id))
    .leftJoin(teams, eq(employees.teamId, teams.id))
    .where(eq(employees.id, targetEmployeeId))
    .limit(1);

  if (records.length === 0) return null;
  const employeeRecord = records[0];

  // Fetch sensitive financial details
  const sensitiveRows = await db
    .select()
    .from(sensitiveEmployeeDetails)
    .where(eq(sensitiveEmployeeDetails.employeeId, targetEmployeeId))
    .limit(1);

  let sensitiveData: RedactedSensitiveEmployee | undefined;
  if (sensitiveRows.length > 0) {
    const row = sensitiveRows[0];
    const decryptedDetails: RawSensitiveEmployee = {
      id: row.id,
      employeeId: row.employeeId,
      basicSalary: parseFloat(decryptField(row.basicSalaryEncrypted)),
      grossSalary: parseFloat(decryptField(row.grossSalaryEncrypted)),
      netSalary: parseFloat(decryptField(row.netSalaryEncrypted)),
      bankName: row.bankName,
      bankAccountNumber: decryptField(row.bankAccountNumberEncrypted),
      bankIfsc: decryptField(row.bankIfscEncrypted),
      taxIdentifier: decryptField(row.taxIdentifierEncrypted),
      identityDocumentNumber: decryptField(row.identityDocumentNumberEncrypted),
      identityDocumentUrl: decryptField(row.identityDocumentUrlEncrypted),
    };
    sensitiveData = redactSensitiveDetails(decryptedDetails, session);
  }

  return {
    ...employeeRecord,
    departmentName: employeeRecord.departmentName || undefined,
    locationName: employeeRecord.locationName || undefined,
    teamName: employeeRecord.teamName || undefined,
    sensitive: sensitiveData,
  };
}
