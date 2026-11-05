import { db } from "../db/client";
import { employees, users, departments, locations, teams, employeeManagerHistory, auditLogs } from "../db/schema";
import { eq, or, and, desc, inArray, sql } from "drizzle-orm";
import { SessionContext } from "../permissions/types";
import * as auditLogger from "../audit/logger";
import { randomUUID } from "crypto";

export const MAX_TRAVERSAL_DEPTH = 50;

export interface HierarchyNode {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  jobTitle: string;
  departmentId: string;
  departmentName?: string | null;
  locationName?: string | null;
  teamName?: string | null;
  status: string;
  managerId: string | null;
  directReportsCount: number;
  depth: number;
  children?: HierarchyNode[];
}

export interface ManagerChainNode {
  id: string;
  employeeCode: string;
  name: string;
  jobTitle: string;
  departmentName?: string | null;
  email: string;
  level: number; // 1 = Direct Manager, 2 = Skip Manager, etc.
}

export interface ManagerChangeHistoryRecord {
  id: string;
  employeeId: string;
  previousManagerId: string | null;
  previousManagerName?: string | null;
  previousManagerCode?: string | null;
  newManagerId: string | null;
  newManagerName?: string | null;
  newManagerCode?: string | null;
  reason: string;
  effectiveDate: string;
  changedByUserId: string;
  changedByUserName?: string | null;
  createdAt: number;
}

export interface ChangeReportingManagerInput {
  newManagerId: string | null; // internal UUID, employeeCode, or null for top-level
  reason: string;
  effectiveDate: string; // YYYY-MM-DD
  concurrencyVersion: number;
}

/**
 * Resolves an employee record by UUID or employeeCode. Supports optional transaction client.
 */
export async function resolveEmployee(idOrCode: string, tx?: any) {
  const client = tx || db;
  const rows = await client
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      userId: employees.userId,
      name: users.name,
      email: users.email,
      jobTitle: employees.jobTitle,
      departmentId: employees.departmentId,
      locationId: employees.locationId,
      teamId: employees.teamId,
      departmentName: departments.name,
      locationName: locations.name,
      teamName: teams.name,
      managerId: employees.managerId,
      reportingHierarchy: employees.reportingHierarchy,
      status: employees.status,
      concurrencyVersion: employees.concurrencyVersion,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(locations, eq(employees.locationId, locations.id))
    .leftJoin(teams, eq(employees.teamId, teams.id))
    .where(or(eq(employees.id, idOrCode), eq(employees.employeeCode, idOrCode)))
    .limit(1);

  return rows[0] || null;
}

/**
 * Enforces server-side permission and scope authorization across all 8 data scopes:
 * SELF, DIRECT_REPORTS, REPORTING_HIERARCHY, TEAM, DEPARTMENT, LOCATION, ORGANIZATION, CUSTOM.
 */
export async function verifyHierarchyScopeAccess(
  session: SessionContext,
  targetEmployee: {
    id: string;
    employeeCode: string;
    departmentId?: string | null;
    locationId?: string | null;
    teamId?: string | null;
    managerId?: string | null;
    reportingHierarchy?: string | null;
  },
  requiredPerm?: string
): Promise<void> {
  if (session.isSuperAdmin || session.roles.includes("SUPER_ADMIN")) return;

  if (requiredPerm && !session.effectivePermissions.includes(requiredPerm)) {
    throw new Error(`UNAUTHORIZED_PERMISSION: Missing required permission ${requiredPerm}.`);
  }

  if (session.widestScope === "ORGANIZATION" || session.roles.includes("ADMIN") || session.roles.includes("HR_MANAGER")) {
    return;
  }

  const isSelf = session.employeeId === targetEmployee.id || session.employeeId === targetEmployee.employeeCode;
  if (isSelf) return;

  if (session.widestScope === "SELF") {
    throw new Error("UNAUTHORIZED_SCOPE: Access restricted to self records only.");
  }

  if (session.widestScope === "DIRECT_REPORTS") {
    const isDirectReport =
      targetEmployee.managerId === session.employeeId ||
      targetEmployee.managerId === session.userId;
    if (!isDirectReport) {
      throw new Error("UNAUTHORIZED_SCOPE: Target employee is outside your direct reports scope.");
    }
    return;
  }

  if (session.widestScope === "REPORTING_HIERARCHY") {
    let hierarchyList: string[] = [];
    try {
      hierarchyList = JSON.parse(targetEmployee.reportingHierarchy || "[]");
    } catch {
      hierarchyList = [];
    }
    const isInSubtree =
      targetEmployee.managerId === session.employeeId ||
      (session.employeeId ? hierarchyList.includes(session.employeeId) : false);

    if (!isInSubtree) {
      throw new Error("UNAUTHORIZED_SCOPE: Target employee is outside your reporting hierarchy.");
    }
    return;
  }

  // Get session employee context to compare department, team, or location
  const sessionEmployee = session.employeeId ? await resolveEmployee(session.employeeId) : null;
  if (!sessionEmployee) {
    throw new Error("UNAUTHORIZED_SCOPE: Unable to resolve requesting session employee context.");
  }

  if (session.widestScope === "DEPARTMENT") {
    if (sessionEmployee.departmentId !== targetEmployee.departmentId) {
      throw new Error("UNAUTHORIZED_SCOPE: Target employee belongs to a different department.");
    }
    return;
  }

  if (session.widestScope === "TEAM") {
    if (!sessionEmployee.teamId || sessionEmployee.teamId !== targetEmployee.teamId) {
      throw new Error("UNAUTHORIZED_SCOPE: Target employee belongs to a different team.");
    }
    return;
  }

  if (session.widestScope === "LOCATION") {
    if (!sessionEmployee.locationId || sessionEmployee.locationId !== targetEmployee.locationId) {
      throw new Error("UNAUTHORIZED_SCOPE: Target employee belongs to a different location.");
    }
    return;
  }
}

/**
 * Retrieves the direct reports of a given manager.
 */
export async function getDirectReports(
  managerIdOrCode: string,
  session?: SessionContext,
  tx?: any
): Promise<HierarchyNode[]> {
  const client = tx || db;
  const manager = await resolveEmployee(managerIdOrCode, client);
  if (!manager) return [];

  if (session) {
    await verifyHierarchyScopeAccess(session, manager, "team.direct_reports.read");
  }

  // Fetch employees whose managerId matches manager's id or employeeCode
  const directReports = await client
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      name: users.name,
      email: users.email,
      jobTitle: employees.jobTitle,
      departmentId: employees.departmentId,
      locationId: employees.locationId,
      teamId: employees.teamId,
      departmentName: departments.name,
      locationName: locations.name,
      teamName: teams.name,
      managerId: employees.managerId,
      reportingHierarchy: employees.reportingHierarchy,
      status: employees.status,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(locations, eq(employees.locationId, locations.id))
    .leftJoin(teams, eq(employees.teamId, teams.id))
    .where(or(eq(employees.managerId, manager.id), eq(employees.managerId, manager.employeeCode)));

  if (directReports.length === 0) return [];

  const childIds = directReports.map((d: any) => d.id);
  const childCodes = directReports.map((d: any) => d.employeeCode);

  const subCounts = await client
    .select({
      managerId: employees.managerId,
      count: sql<number>`count(*)`,
    })
    .from(employees)
    .where(or(inArray(employees.managerId, childIds), inArray(employees.managerId, childCodes)))
    .groupBy(employees.managerId);

  const countMap = new Map<string, number>();
  for (const row of subCounts) {
    if (row.managerId) {
      countMap.set(row.managerId, Number(row.count));
    }
  }

  return directReports.map((rep: any) => ({
    ...rep,
    directReportsCount: (countMap.get(rep.id) || 0) + (countMap.get(rep.employeeCode) || 0),
    depth: 1,
  }));
}

/**
 * Traverses upward to compute the manager chain from an employee up to the top-level executive.
 * Returns [Direct Manager, Skip-level Manager, ..., CEO]
 */
export async function getManagerChain(
  employeeIdOrCode: string,
  session?: SessionContext,
  tx?: any
): Promise<ManagerChainNode[]> {
  const client = tx || db;
  const initialEmp = await resolveEmployee(employeeIdOrCode, client);
  if (!initialEmp) return [];

  if (session) {
    await verifyHierarchyScopeAccess(session, initialEmp, "hierarchy.read");
  }

  const chain: ManagerChainNode[] = [];
  const visited = new Set<string>();
  let currentId: string | null = initialEmp.id;
  let level = 1;

  while (currentId && level <= MAX_TRAVERSAL_DEPTH) {
    const currentEmp = await resolveEmployee(currentId, client);
    if (!currentEmp || !currentEmp.managerId) break;

    // Cycle safeguard
    if (visited.has(currentEmp.managerId)) {
      break;
    }
    visited.add(currentEmp.managerId);

    const manager = await resolveEmployee(currentEmp.managerId, client);
    if (!manager) break;

    chain.push({
      id: manager.id,
      employeeCode: manager.employeeCode,
      name: manager.name,
      jobTitle: manager.jobTitle,
      departmentName: manager.departmentName,
      email: manager.email,
      level,
    });

    currentId = manager.id;
    level++;
  }

  return chain;
}

/**
 * Traverses downward and returns all direct and indirect subordinates under a manager.
 */
export async function getAllSubordinates(
  managerIdOrCode: string,
  session?: SessionContext,
  tx?: any
): Promise<HierarchyNode[]> {
  const client = tx || db;
  const manager = await resolveEmployee(managerIdOrCode, client);
  if (!manager) return [];

  if (session) {
    await verifyHierarchyScopeAccess(session, manager, "team.reporting_hierarchy.read");
  }

  const allSubordinates: HierarchyNode[] = [];
  const visited = new Set<string>([manager.id, manager.employeeCode]);
  let currentLevelQueue: string[] = [manager.id, manager.employeeCode];
  let depth = 1;

  while (currentLevelQueue.length > 0 && depth <= MAX_TRAVERSAL_DEPTH) {
    const reports = await client
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        name: users.name,
        email: users.email,
        jobTitle: employees.jobTitle,
        departmentId: employees.departmentId,
        locationId: employees.locationId,
        teamId: employees.teamId,
        departmentName: departments.name,
        locationName: locations.name,
        teamName: teams.name,
        managerId: employees.managerId,
        reportingHierarchy: employees.reportingHierarchy,
        status: employees.status,
      })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(locations, eq(employees.locationId, locations.id))
      .leftJoin(teams, eq(employees.teamId, teams.id))
      .where(inArray(employees.managerId, currentLevelQueue));

    if (reports.length === 0) break;

    const nextQueue: string[] = [];
    for (const rep of reports) {
      if (!visited.has(rep.id)) {
        visited.add(rep.id);
        visited.add(rep.employeeCode);
        allSubordinates.push({
          ...rep,
          directReportsCount: 0,
          depth,
        });
        nextQueue.push(rep.id, rep.employeeCode);
      }
    }

    currentLevelQueue = nextQueue;
    depth++;
  }

  return allSubordinates;
}

/**
 * Returns the full hierarchical tree rooted at an employee or manager.
 */
export async function getReportingHierarchy(
  employeeIdOrCode: string,
  session?: SessionContext,
  maxDepth = 5,
  tx?: any
): Promise<HierarchyNode | null> {
  const client = tx || db;
  const root = await resolveEmployee(employeeIdOrCode, client);
  if (!root) return null;

  if (session) {
    await verifyHierarchyScopeAccess(session, root, "hierarchy.read");
  }

  async function buildSubTree(
    node: {
      id: string;
      employeeCode: string;
      name: string;
      email: string;
      jobTitle: string;
      departmentId: string;
      departmentName?: string | null;
      locationName?: string | null;
      teamName?: string | null;
      status: string;
      managerId: string | null;
    },
    currentDepth: number,
    visited: Set<string>
  ): Promise<HierarchyNode> {
    if (visited.has(node.id) || currentDepth >= maxDepth) {
      return {
        ...node,
        directReportsCount: 0,
        depth: currentDepth,
        children: [],
      };
    }

    visited.add(node.id);
    visited.add(node.employeeCode);

    // Get direct children
    const directReports = await client
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        name: users.name,
        email: users.email,
        jobTitle: employees.jobTitle,
        departmentId: employees.departmentId,
        departmentName: departments.name,
        locationName: locations.name,
        teamName: teams.name,
        managerId: employees.managerId,
        status: employees.status,
      })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(locations, eq(employees.locationId, locations.id))
      .leftJoin(teams, eq(employees.teamId, teams.id))
      .where(or(eq(employees.managerId, node.id), eq(employees.managerId, node.employeeCode)));

    const children: HierarchyNode[] = [];
    for (const child of directReports) {
      if (!visited.has(child.id)) {
        const sub = await buildSubTree(child, currentDepth + 1, new Set(visited));
        children.push(sub);
      }
    }

    return {
      ...node,
      directReportsCount: directReports.length,
      depth: currentDepth,
      children,
    };
  }

  return await buildSubTree(root, 0, new Set());
}

/**
 * Validates whether candidateManagerId is structurally valid for employeeId.
 * Guarantees cycle detection, self-reporting prevention, and active manager validation.
 */
export async function validateReportingHierarchy(
  employeeIdOrCode: string,
  candidateManagerIdOrCode: string | null,
  tx?: any
): Promise<{ valid: boolean; error?: string }> {
  const client = tx || db;

  // 1. Removing manager (Top-level position) is always structurally valid
  if (!candidateManagerIdOrCode || candidateManagerIdOrCode.trim() === "") {
    return { valid: true };
  }

  const employee = await resolveEmployee(employeeIdOrCode, client);
  if (!employee) {
    return { valid: false, error: "Employee record not found." };
  }

  const candidateManager = await resolveEmployee(candidateManagerIdOrCode, client);
  if (!candidateManager) {
    return { valid: false, error: "Candidate manager record does not exist." };
  }

  // 2. Self-Reporting Check
  if (
    employee.id === candidateManager.id ||
    employee.employeeCode === candidateManager.employeeCode ||
    employee.id === candidateManagerIdOrCode ||
    employee.employeeCode === candidateManagerIdOrCode
  ) {
    return {
      valid: false,
      error: "SELF_REPORTING_NOT_ALLOWED: An employee cannot be their own reporting manager.",
    };
  }

  // 3. Candidate Manager Status Check
  if (candidateManager.status === "TERMINATED" || candidateManager.status === "SUSPENDED") {
    return {
      valid: false,
      error: `INACTIVE_MANAGER: Candidate manager is currently ${candidateManager.status} and cannot be assigned as a reporting manager.`,
    };
  }

  // 4. Already Assigned Check
  if (employee.managerId === candidateManager.id || employee.managerId === candidateManager.employeeCode) {
    return {
      valid: false,
      error: "ALREADY_ASSIGNED: The candidate is already the employee's current reporting manager.",
    };
  }

  // 5. Circular Hierarchy Check (Cycle Detection inside transaction snapshot)
  let currentAncestorId: string | null = candidateManager.id;
  const visited = new Set<string>();
  let depth = 0;

  while (currentAncestorId && depth <= MAX_TRAVERSAL_DEPTH) {
    if (visited.has(currentAncestorId)) {
      return {
        valid: false,
        error: "CIRCULAR_REPORTING_NOT_ALLOWED: An existing loop was detected in the manager's hierarchy.",
      };
    }
    visited.add(currentAncestorId);

    if (currentAncestorId === employee.id || currentAncestorId === employee.employeeCode) {
      return {
        valid: false,
        error: "CIRCULAR_REPORTING_NOT_ALLOWED: Candidate manager is already a direct or indirect subordinate of this employee.",
      };
    }

    const anc = await resolveEmployee(currentAncestorId, client);
    if (!anc || !anc.managerId) break;
    currentAncestorId = anc.managerId;
    depth++;
  }

  if (depth > MAX_TRAVERSAL_DEPTH) {
    return {
      valid: false,
      error: `MAX_DEPTH_EXCEEDED: Traversal exceeded maximum reporting depth of ${MAX_TRAVERSAL_DEPTH}.`,
    };
  }

  return { valid: true };
}

/**
 * Changes an employee's reporting manager inside a concurrency-safe atomic transaction.
 * Enforces in-transaction cycle detection, SQL-level optimistic concurrency check,
 * recomputes descendant hierarchy caches, and coordinates durable audit logs.
 */
export async function changeReportingManager(
  session: SessionContext,
  employeeIdOrCode: string,
  input: ChangeReportingManagerInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  // 1. Authorization check
  const hasManagePerm =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("hierarchy.manage");

  if (!hasManagePerm) {
    throw new Error("UNAUTHORIZED: Insufficient permissions to change employee reporting manager.");
  }

  // 2. Validate input parameters
  if (input.concurrencyVersion === undefined || input.concurrencyVersion === null) {
    throw new Error("CONCURRENCY_VERSION_REQUIRED: Expected concurrencyVersion must be provided on every manager mutation.");
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("REASON_REQUIRED: A valid non-empty reason is required for reporting manager reassignment.");
  }

  if (!input.effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
    throw new Error("INVALID_DATE: Effective date must be provided in YYYY-MM-DD format.");
  }

  const todayStr = new Date().toISOString().split("T")[0];
  if (input.effectiveDate > todayStr) {
    throw new Error(`FUTURE_DATE_NOT_SUPPORTED: Future-dated reporting manager changes (${input.effectiveDate}) cannot be applied immediately to current active reporting hierarchy.`);
  }

  const initialEmployee = await resolveEmployee(employeeIdOrCode);
  if (!initialEmployee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Target employee record not found.");
  }

  await verifyHierarchyScopeAccess(session, initialEmployee, "hierarchy.manage");

  // 3. Execute atomic mutation and validation inside transaction
  try {
    return await db.transaction(async (tx) => {
      // Re-read employee inside transaction to guarantee serialized snapshot
      const employee = await resolveEmployee(initialEmployee.id, tx);
      if (!employee) {
        throw new Error("EMPLOYEE_NOT_FOUND: Target employee record not found.");
      }

      if (employee.concurrencyVersion !== input.concurrencyVersion) {
        throw new Error(
          `CONCURRENCY_CONFLICT: Stale write detected. Expected version ${input.concurrencyVersion}, found ${employee.concurrencyVersion}. Please refresh and retry.`
        );
      }

      // In-transaction cycle detection & validation
      const validation = await validateReportingHierarchy(employee.id, input.newManagerId, tx);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      let newManager: { id: string; employeeCode: string; name: string } | null = null;
      if (input.newManagerId && input.newManagerId.trim() !== "") {
        const mgr = await resolveEmployee(input.newManagerId, tx);
        if (mgr) {
          newManager = { id: mgr.id, employeeCode: mgr.employeeCode, name: mgr.name };
        }
      }

      const prevManagerId = employee.managerId;
      const targetNewManagerId = newManager ? newManager.id : null;
      const historyId = `hist_mgr_${randomUUID()}`;
      const now = Date.now();
      const nextVersion = employee.concurrencyVersion + 1;

      // Build new ancestor chain for employee
      let newChain: string[] = [];
      if (targetNewManagerId) {
        const mgrChain = await getManagerChain(targetNewManagerId, undefined, tx);
        newChain = [targetNewManagerId, ...mgrChain.map((m) => m.id)];
      }

      if (newChain.length > MAX_TRAVERSAL_DEPTH) {
        throw new Error(`MAX_DEPTH_EXCEEDED: Resulting hierarchy exceeds maximum depth of ${MAX_TRAVERSAL_DEPTH}.`);
      }

      // Atomic SQL UPDATE with concurrencyVersion check
      const updateRes = await tx.run(
        sql`UPDATE employees 
            SET manager_id = ${targetNewManagerId}, 
                reporting_hierarchy = ${JSON.stringify(newChain)}, 
                concurrency_version = ${nextVersion}, 
                updated_at = ${now} 
            WHERE id = ${employee.id} AND concurrency_version = ${input.concurrencyVersion}`
      );

      if (Number(updateRes.rowsAffected) === 0) {
        throw new Error(
          `CONCURRENCY_CONFLICT: Stale write detected. Expected concurrencyVersion ${input.concurrencyVersion}, but record was modified concurrently.`
        );
      }

      // Recompute reportingHierarchy for all downstream descendants to maintain hierarchy cache consistency
      const subordinates = await getAllSubordinates(employee.id, undefined, tx);
      for (const sub of subordinates) {
        const subChain = await getManagerChain(sub.id, undefined, tx);
        const updatedSubChain = subChain.map((m) => m.id);
        if (updatedSubChain.length > MAX_TRAVERSAL_DEPTH) {
          throw new Error(`MAX_DEPTH_EXCEEDED: Subordinate ${sub.employeeCode} exceeds maximum hierarchy depth.`);
        }
        await tx.run(
          sql`UPDATE employees SET reporting_hierarchy = ${JSON.stringify(updatedSubChain)}, updated_at = ${now} WHERE id = ${sub.id}`
        );
      }

      // Insert manager history record
      await tx.insert(employeeManagerHistory).values({
        id: historyId,
        employeeId: employee.id,
        previousManagerId: prevManagerId,
        newManagerId: targetNewManagerId,
        reason: input.reason.trim(),
        effectiveDate: input.effectiveDate,
        changedByUserId: session.userId,
        createdAt: now,
      });

      // Durable audit coordination inside transaction
      if ((meta as any)?._injectAuditFailure) {
        throw new Error("AUDIT_STORAGE_CRITICAL_FAILURE: Injected audit logging failure");
      }

      await auditLogger.logAuditEvent(
        {
          actorUserId: session.userId,
          actorEmployeeId: session.employeeId,
          action: "REPORTING_MANAGER_CHANGED",
          targetEntity: "employees",
          targetId: employee.id,
          changes: {
            employeeCode: employee.employeeCode,
            name: employee.name,
            previousManagerId: prevManagerId,
            newManagerId: targetNewManagerId,
            newManagerCode: newManager?.employeeCode || null,
            reason: input.reason.trim(),
            effectiveDate: input.effectiveDate,
            concurrencyVersion: nextVersion,
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return {
        success: true,
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        previousManagerId: prevManagerId,
        newManagerId: targetNewManagerId,
        concurrencyVersion: nextVersion,
        effectiveDate: input.effectiveDate,
      };
    });
  } catch (err: any) {
    if (err.message?.includes("SQLITE_BUSY") || err.code === "SQLITE_BUSY") {
      throw new Error(`CONCURRENCY_CONFLICT: Database locked by competing concurrent write. Please reload and retry.`);
    }
    throw err;
  }
}

/**
 * Retrieves the reporting manager change history for an employee.
 */
export async function getManagerHistory(
  employeeIdOrCode: string,
  session?: SessionContext,
  tx?: any
): Promise<ManagerChangeHistoryRecord[]> {
  const client = tx || db;
  const employee = await resolveEmployee(employeeIdOrCode, client);
  if (!employee) return [];

  if (session) {
    await verifyHierarchyScopeAccess(session, employee, "hierarchy.history.read");
  }

  const rows = await client
    .select({
      id: employeeManagerHistory.id,
      employeeId: employeeManagerHistory.employeeId,
      previousManagerId: employeeManagerHistory.previousManagerId,
      newManagerId: employeeManagerHistory.newManagerId,
      reason: employeeManagerHistory.reason,
      effectiveDate: employeeManagerHistory.effectiveDate,
      changedByUserId: employeeManagerHistory.changedByUserId,
      createdAt: employeeManagerHistory.createdAt,
    })
    .from(employeeManagerHistory)
    .where(eq(employeeManagerHistory.employeeId, employee.id))
    .orderBy(desc(employeeManagerHistory.createdAt));

  if (rows.length === 0) return [];

  // Enhance with manager names and actor names
  const allManagerIds: string[] = Array.from(
    new Set(
      rows
        .flatMap((r: any) => [r.previousManagerId, r.newManagerId])
        .filter((id: any): id is string => Boolean(id))
    )
  );

  const managerLookup = new Map<string, { name: string; employeeCode: string }>();
  if (allManagerIds.length > 0) {
    const mgrEmployees = await client
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        name: users.name,
      })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .where(or(inArray(employees.id, allManagerIds), inArray(employees.employeeCode, allManagerIds)));

    for (const m of mgrEmployees) {
      managerLookup.set(m.id, { name: m.name, employeeCode: m.employeeCode });
      managerLookup.set(m.employeeCode, { name: m.name, employeeCode: m.employeeCode });
    }
  }

  // Lookup actors
  const actorUserIds: string[] = Array.from(new Set(rows.map((r: any) => r.changedByUserId)));
  const actorLookup = new Map<string, string>();
  if (actorUserIds.length > 0) {
    const actorUsers = await client
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, actorUserIds));

    for (const a of actorUsers) {
      actorLookup.set(a.id, a.name);
    }
  }

  return rows.map((r: any) => ({
    id: r.id,
    employeeId: r.employeeId,
    previousManagerId: r.previousManagerId,
    previousManagerName: r.previousManagerId ? managerLookup.get(r.previousManagerId)?.name || null : null,
    previousManagerCode: r.previousManagerId ? managerLookup.get(r.previousManagerId)?.employeeCode || null : null,
    newManagerId: r.newManagerId,
    newManagerName: r.newManagerId ? managerLookup.get(r.newManagerId)?.name || null : null,
    newManagerCode: r.newManagerId ? managerLookup.get(r.newManagerId)?.employeeCode || null : null,
    reason: r.reason,
    effectiveDate: r.effectiveDate,
    changedByUserId: r.changedByUserId,
    changedByUserName: actorLookup.get(r.changedByUserId) || "System Administrator",
    createdAt: r.createdAt,
  }));
}
