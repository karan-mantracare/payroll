import { SessionContext } from "../permissions/types";
import { employees } from "../db/schema";
import { eq, or, inArray, sql, SQL } from "drizzle-orm";

/**
 * Generates Drizzle SQL WHERE conditions based on the caller's session and widest data scope.
 */
export function buildScopeCondition(session: SessionContext): SQL | undefined {
  if (session.isSuperAdmin || session.widestScope === "ORGANIZATION") {
    // Unrestricted within organization
    return eq(employees.organizationId, session.organizationId);
  }

  const empId = session.employeeId;
  if (!empId) {
    // User has no employee profile, allow nothing
    return sql`1 = 0`;
  }

  switch (session.widestScope) {
    case "SELF":
      return eq(employees.id, empId);

    case "DIRECT_REPORTS":
      return or(
        eq(employees.id, empId),
        eq(employees.managerId, empId)
      );

    case "REPORTING_HIERARCHY":
      return or(
        eq(employees.id, empId),
        eq(employees.managerId, empId),
        sql`${employees.reportingHierarchy} LIKE ${`%"${empId}"%`}`
      );

    case "TEAM":
      if (session.managedTeamIds.length > 0) {
        return or(
          eq(employees.id, empId),
          inArray(employees.teamId, session.managedTeamIds)
        );
      }
      return eq(employees.id, empId);

    case "DEPARTMENT":
      if (session.managedDepartmentIds.length > 0) {
        return or(
          eq(employees.id, empId),
          inArray(employees.departmentId, session.managedDepartmentIds)
        );
      }
      return eq(employees.id, empId);

    case "LOCATION":
      if (session.locationId) {
        return or(
          eq(employees.id, empId),
          eq(employees.locationId, session.locationId)
        );
      }
      return eq(employees.id, empId);

    case "CUSTOM":
      // Fallback to self + direct reports if no custom rule
      return or(eq(employees.id, empId), eq(employees.managerId, empId));

    default:
      return eq(employees.id, empId);
  }
}

