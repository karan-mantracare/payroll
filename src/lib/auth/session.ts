import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "../db/client";
import { authSessions, users, employees, userRoles } from "../db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { SessionContext } from "../permissions/types";
import { resolveUserPermissions } from "../permissions/evaluator";

export const SESSION_COOKIE_NAME = "mc_payroll_session";
const SESSION_TTL_MS = (parseInt(process.env.SESSION_EXPIRY_SECONDS || "28800", 10)) * 1000;

export async function createSession(
  userId: string,
  tokenHash: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const sessionId = randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  await db.insert(authSessions).values({
    sessionId,
    userId,
    tokenHash,
    createdAt: now,
    expiresAt,
    revokedAt: null,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
  });

  return sessionId;
}

/**
 * Validates the session cookie and returns the full SessionContext with permissions and scopes.
 */
export async function getSessionContext(sessionId?: string): Promise<SessionContext | null> {
  let targetSessionId = sessionId;

  if (!targetSessionId) {
    try {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
      if (!sessionCookie) return null;
      targetSessionId = sessionCookie.value;
    } catch {
      return null;
    }
  }

  if (!targetSessionId) return null;

  const now = Date.now();

  // 1. Fetch valid session
  const validSessions = await db
    .select()
    .from(authSessions)
    .where(
      and(
        eq(authSessions.sessionId, targetSessionId),
        gt(authSessions.expiresAt, now),
        isNull(authSessions.revokedAt)
      )
    )
    .limit(1);

  if (validSessions.length === 0) return null;
  const session = validSessions[0];

  // 2. Fetch user
  const userRecords = await db
    .select()
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.status, "ACTIVE")))
    .limit(1);

  if (userRecords.length === 0) return null;
  const user = userRecords[0];

  // 3. Fetch employee profile
  const employeeRecords = await db
    .select()
    .from(employees)
    .where(eq(employees.userId, user.id))
    .limit(1);

  const emp = employeeRecords[0] || undefined;

  // 4. Fetch assigned roles
  const assignedRoles = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));

  const roleKeys = assignedRoles.map((r) => r.roleKey);
  const { effectivePermissions, widestScope, isSuperAdmin } = resolveUserPermissions(roleKeys);

  // 5. Build managed scopes (departments, teams, direct reports)
  let managedDepartmentIds: string[] = [];
  let managedTeamIds: string[] = [];
  let directReportIds: string[] = [];

  if (emp) {
    const directReports = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.managerId, emp.id));
    directReportIds = directReports.map((d) => d.id);

    if (emp.departmentId) managedDepartmentIds = [emp.departmentId];
    if (emp.teamId) managedTeamIds = [emp.teamId];
  }

  return {
    userId: user.id,
    employeeId: emp?.id,
    name: user.name,
    email: user.email,
    organizationId: emp?.organizationId || "org_default",
    departmentId: emp?.departmentId,
    locationId: emp?.locationId,
    teamId: emp?.teamId || undefined,
    roles: roleKeys,
    effectivePermissions: Array.from(effectivePermissions),
    widestScope,
    managedDepartmentIds,
    managedTeamIds,
    directReportIds,
    isSuperAdmin,
  };
}

/**
 * Revokes an active session.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await db
    .update(authSessions)
    .set({ revokedAt: Date.now() })
    .where(eq(authSessions.sessionId, sessionId));
}

