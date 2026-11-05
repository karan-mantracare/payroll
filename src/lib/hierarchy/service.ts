import { db } from "../db/client";
import { employees, users, departments, locations, teams, employeeManagerHistory, auditLogs } from "../db/schema";
import { eq, or, and, desc, inArray, sql } from "drizzle-orm";
import { SessionContext } from "../permissions/types";
import { logAuditEvent } from "../audit/logger";
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
  concurrencyVersion?: number;
}

/**
 * Resolves an employee record by UUID or employeeCode.
 */
async function resolveEmployee(idOrCode: string) {
  const rows = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      userId: employees.userId,
      name: users.name,
      email: users.email,
      jobTitle: employees.jobTitle,
      departmentId: employees.departmentId,
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
 * Retrieves the direct reports of a given manager.
 */
export async function getDirectReports(
  managerIdOrCode: string,
  session?: SessionContext
): Promise<HierarchyNode[]> {
  const manager = await resolveEmployee(managerIdOrCode);
  if (!manager) return [];

  // Data Scope and Permission Check
  if (session && !session.isSuperAdmin && session.widestScope !== "ORGANIZATION") {
    const isSelf = session.employeeId === manager.id || session.employeeId === manager.employeeCode;
    const hasTeamPerm = session.effectivePermissions.includes("team.direct_reports.read");
    const hasHierarchyPerm = session.effectivePermissions.includes("hierarchy.read");

    if (session.widestScope === "SELF" && (!isSelf || !hasTeamPerm)) {
      throw new Error("Unauthorized: You do not have permission to view other managers' direct reports.");
    }

    if (session.widestScope === "DIRECT_REPORTS" && !isSelf && !hasHierarchyPerm) {
      throw new Error("Unauthorized: Direct reports access is restricted to your own reporting line.");
    }
  }

  // Fetch employees whose managerId matches manager's id or employeeCode
  const directReports = await db
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
    .where(or(eq(employees.managerId, manager.id), eq(employees.managerId, manager.employeeCode)));

  if (directReports.length === 0) return [];

  // Count direct reports for each of these children
  const childIds = directReports.map((d) => d.id);
  const childCodes = directReports.map((d) => d.employeeCode);

  const subCounts = await db
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

  return directReports.map((rep) => ({
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
  session?: SessionContext
): Promise<ManagerChainNode[]> {
  const chain: ManagerChainNode[] = [];
  const visited = new Set<string>();
  let currentId: string | null = employeeIdOrCode;
  let level = 1;

  while (currentId && level <= MAX_TRAVERSAL_DEPTH) {
    const currentEmp = await resolveEmployee(currentId);
    if (!currentEmp || !currentEmp.managerId) break;

    // Cycle safeguard
    if (visited.has(currentEmp.managerId)) {
      break;
    }
    visited.add(currentEmp.managerId);

    const manager = await resolveEmployee(currentEmp.managerId);
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
  session?: SessionContext
): Promise<HierarchyNode[]> {
  const manager = await resolveEmployee(managerIdOrCode);
  if (!manager) return [];

  const allSubordinates: HierarchyNode[] = [];
  const visited = new Set<string>([manager.id, manager.employeeCode]);
  let currentLevelQueue: string[] = [manager.id, manager.employeeCode];
  let depth = 1;

  while (currentLevelQueue.length > 0 && depth <= MAX_TRAVERSAL_DEPTH) {
    const reports = await db
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
  maxDepth = 5
): Promise<HierarchyNode | null> {
  const root = await resolveEmployee(employeeIdOrCode);
  if (!root) return null;

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
    const directReports = await db
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
 * Validates whether candidateManagerId is a valid reporting manager for employeeId.
 * Guarantees cycle detection, self-reporting prevention, and active manager validation.
 */
export async function validateReportingHierarchy(
  employeeIdOrCode: string,
  candidateManagerIdOrCode: string | null
): Promise<{ valid: boolean; error?: string }> {
  // 1. Removing manager (Top-level position) is always structurally valid
  if (!candidateManagerIdOrCode || candidateManagerIdOrCode.trim() === "") {
    return { valid: true };
  }

  const employee = await resolveEmployee(employeeIdOrCode);
  if (!employee) {
    return { valid: false, error: "Employee record not found." };
  }

  const candidateManager = await resolveEmployee(candidateManagerIdOrCode);
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

  // 3. Already Assigned Check
  if (employee.managerId === candidateManager.id || employee.managerId === candidateManager.employeeCode) {
    return {
      valid: false,
      error: "ALREADY_ASSIGNED: The candidate is already the employee's current reporting manager.",
    };
  }

  // 4. Candidate Manager Status Check
  if (candidateManager.status === "TERMINATED" || candidateManager.status === "SUSPENDED") {
    return {
      valid: false,
      error: `INACTIVE_MANAGER: Candidate manager is currently ${candidateManager.status} and cannot be assigned as a reporting manager.`,
    };
  }

  // 5. Circular Hierarchy Check (Cycle Detection)
  // Check if candidateManager or any of candidateManager's ancestors is the employee
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

    const anc = await resolveEmployee(currentAncestorId);
    if (!anc || !anc.managerId) break;
    currentAncestorId = anc.managerId;
    depth++;
  }

  return { valid: true };
}

/**
 * Changes an employee's reporting manager inside an atomic transaction.
 * Enforces cycle detection, optimistic concurrency control, and records tamper-evident audit logs.
 */
export async function changeReportingManager(
  session: SessionContext,
  employeeIdOrCode: string,
  input: ChangeReportingManagerInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  // Authorization check
  const hasManagePerm =
    session.isSuperAdmin ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("hierarchy.manage");

  if (!hasManagePerm) {
    throw new Error("Unauthorized: Insufficient permissions to change employee reporting manager.");
  }

  const employee = await resolveEmployee(employeeIdOrCode);
  if (!employee) {
    throw new Error("Employee not found.");
  }

  // Optimistic concurrency control check
  if (input.concurrencyVersion !== undefined && employee.concurrencyVersion !== input.concurrencyVersion) {
    throw new Error(
      `CONCURRENCY_CONFLICT: Employee record was modified concurrently. Expected version ${input.concurrencyVersion}, found ${employee.concurrencyVersion}. Please refresh and retry.`
    );
  }

  // Validate hierarchy rules (Cycle detection, self-reporting, active manager)
  const validation = await validateReportingHierarchy(employee.id, input.newManagerId);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  let newManager: { id: string; employeeCode: string; name: string } | null = null;
  if (input.newManagerId && input.newManagerId.trim() !== "") {
    const mgr = await resolveEmployee(input.newManagerId);
    if (mgr) {
      newManager = { id: mgr.id, employeeCode: mgr.employeeCode, name: mgr.name };
    }
  }

  const prevManagerId = employee.managerId;
  const targetNewManagerId = newManager ? newManager.id : null;
  const historyId = `hist_mgr_${randomUUID()}`;
  const now = Date.now();
  const nextVersion = employee.concurrencyVersion + 1;

  // Build new manager chain cache
  let newChain: string[] = [];
  if (targetNewManagerId) {
    const mgrChain = await getManagerChain(targetNewManagerId);
    newChain = [targetNewManagerId, ...mgrChain.map((m) => m.id)];
  }

  // Execute in LibSQL / Turso transaction
  await db.transaction(async (tx) => {
    // 1. Update employee managerId and reportingHierarchy
    await tx
      .update(employees)
      .set({
        managerId: targetNewManagerId,
        reportingHierarchy: JSON.stringify(newChain),
        concurrencyVersion: nextVersion,
        updatedAt: now,
      })
      .where(eq(employees.id, employee.id));

    // 2. Insert into employee_manager_history
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
  });

  // 3. Log Tamper-Evident Audit Event
  await logAuditEvent({
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
      reason: input.reason,
      effectiveDate: input.effectiveDate,
      concurrencyVersion: nextVersion,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    success: true,
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    previousManagerId: prevManagerId,
    newManagerId: targetNewManagerId,
    concurrencyVersion: nextVersion,
    effectiveDate: input.effectiveDate,
  };
}

/**
 * Retrieves the reporting manager change history for an employee.
 */
export async function getManagerHistory(
  employeeIdOrCode: string,
  session?: SessionContext
): Promise<ManagerChangeHistoryRecord[]> {
  const employee = await resolveEmployee(employeeIdOrCode);
  if (!employee) return [];

  // Data Scope & Permission Check
  if (session && !session.isSuperAdmin && session.widestScope !== "ORGANIZATION") {
    const isSelf = session.employeeId === employee.id || session.employeeId === employee.employeeCode;
    const hasHistoryPerm =
      session.effectivePermissions.includes("hierarchy.history.read") ||
      session.effectivePermissions.includes("hierarchy.read");

    if (session.widestScope === "SELF" && !isSelf) {
      throw new Error("Unauthorized: Cannot view reporting history for other employees.");
    }
    if (!hasHistoryPerm) {
      throw new Error("Unauthorized: Insufficient permissions to view reporting history.");
    }
  }

  const rows = await db
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
  const allManagerIds = Array.from(
    new Set(
      rows
        .flatMap((r) => [r.previousManagerId, r.newManagerId])
        .filter((id): id is string => Boolean(id))
    )
  );

  const managerLookup = new Map<string, { name: string; employeeCode: string }>();
  if (allManagerIds.length > 0) {
    const mgrEmployees = await db
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
  const actorUserIds = Array.from(new Set(rows.map((r) => r.changedByUserId)));
  const actorLookup = new Map<string, string>();
  if (actorUserIds.length > 0) {
    const actorUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, actorUserIds));

    for (const a of actorUsers) {
      actorLookup.set(a.id, a.name);
    }
  }

  return rows.map((r) => ({
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

