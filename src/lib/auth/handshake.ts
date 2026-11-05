import { isTokenUsed, markTokenAsUsed, hashToken } from "./tokens";
import { createSession } from "./session";
import { db } from "../db/client";
import { users, employees, userRoles } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "../audit/logger";
import { resolveUserPermissions } from "../permissions/evaluator";

export interface HandshakeResult {
  success: boolean;
  sessionId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
    employeeId?: string;
  };
  error?: string;
  code?: string;
  status: number;
}

export async function processProgramsHandshake(
  token: string,
  ipAddress?: string,
  userAgent?: string
): Promise<HandshakeResult> {
  const programsEndpoint =
    process.env.PROGRAMS_USER_INFO_ENDPOINT || "https://api.mantracare.com/user/user-info";
  const mockApi =
    process.env.MOCK_PROGRAMS_API === "true" || process.env.NODE_ENV === "test";
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return {
      success: false,
      error: "Missing or invalid token parameter",
      code: "TOKEN_MISSING",
      status: 400,
    };
  }

  const cleanToken = token.trim();

  // 1. Replay Attack Prevention Check
  const alreadyUsed = await isTokenUsed(cleanToken);
  if (alreadyUsed) {
    return {
      success: false,
      error: "Token has already been redeemed or expired",
      code: "TOKEN_ALREADY_USED",
      status: 401,
    };
  }

  let platformUserId: string | null = null;
  let platformEmail: string | null = null;
  let platformName: string | null = null;

  // 2. Mock mode for local dev/testing
  if (mockApi && cleanToken.startsWith("test-token-")) {
    const roleSlug = cleanToken.replace("test-token-", "").split("-")[0];
    platformUserId = `plt_${roleSlug}`;
    platformEmail = `${roleSlug}@mantracare.com`;
    platformName = `Test ${roleSlug.toUpperCase()}`;
  } else {
    // 3. Live Server-to-Server handshake with MantraCare Platform API
    try {
      const response = await fetch(programsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cleanToken }),
        cache: "no-store",
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Programs platform rejected token with status ${response.status}`,
          code: "PLATFORM_TOKEN_REJECTED",
          status: 401,
        };
      }

      const data = await response.json();
      platformUserId = data.user_id ? String(data.user_id) : null;
      platformEmail = data.email || null;
      platformName = data.name || "MantraCare User";

      if (!platformUserId) {
        return {
          success: false,
          error: "Programs API response did not contain user_id",
          code: "INVALID_PLATFORM_RESPONSE",
          status: 502,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to contact Programs API: ${err.message}`,
        code: "PLATFORM_CONNECTION_ERROR",
        status: 503,
      };
    }
  }

  // 4. Verify Identity Mapping in HRMS Database
  const mappedUsers = await db
    .select()
    .from(users)
    .where(and(eq(users.platformUserId, platformUserId), eq(users.status, "ACTIVE")))
    .limit(1);

  if (mappedUsers.length === 0) {
    return {
      success: false,
      error: "Platform user is not enrolled as an authorized employee in MantraCare HRMS",
      code: "NOT_AN_AUTHORIZED_EMPLOYEE",
      status: 403,
    };
  }

  const user = mappedUsers[0];

  // 5. Fetch employee record & roles
  const empRecords = await db
    .select()
    .from(employees)
    .where(eq(employees.userId, user.id))
    .limit(1);

  const emp = empRecords[0];

  const assignedRoles = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));

  const roleKeys = assignedRoles.map((r) => r.roleKey);
  const { effectivePermissions } = resolveUserPermissions(roleKeys);

  // 6. Record token as used (Replay Protection)
  await markTokenAsUsed(cleanToken);

  // 7. Mint Server Session
  const tokenHash = hashToken(cleanToken);
  const sessionId = await createSession(user.id, tokenHash, ipAddress, userAgent);

  // 8. Log Audit Record
  await logAuditEvent({
    actorUserId: user.id,
    actorEmployeeId: emp?.id,
    action: "USER_LOGIN_HANDSHAKE_SUCCESS",
    targetEntity: "users",
    targetId: user.id,
    changes: {
      platformUserId,
      roles: roleKeys,
      ipAddress,
    },
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    sessionId,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: roleKeys,
      permissions: Array.from(effectivePermissions),
      employeeId: emp?.id,
    },
    status: 200,
  };
}
