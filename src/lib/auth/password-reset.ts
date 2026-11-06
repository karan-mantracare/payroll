import { randomBytes, createHash } from "crypto";
import { db, rawClient } from "../db/client";
import { users, userCredentials, passwordResetTokens, employees } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "../security/password";
import { revokeSession } from "./session";
import { logAuditEvent } from "../audit/logger";
import { SessionContext } from "../permissions/types";
import { resolveEmployee } from "../hierarchy/service";
import { generateCorrelationId, logSecureError, sanitizeUserFacingError } from "../security/safe-logger";

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface PasswordResetRequestResult {
  success: boolean;
  message: string;
  devResetToken?: string;
  correlationId: string;
}

export interface PasswordResetConfirmResult {
  success: boolean;
  message: string;
  correlationId: string;
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

function validatePasswordComplexity(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== "string" || password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one numeric digit." };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special symbol." };
  }
  return { valid: true };
}

/**
 * Initiates a password reset workflow for the specified email.
 * Prevents account enumeration by always returning success.
 */
export async function requestPasswordReset(
  email: string,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<PasswordResetRequestResult> {
  const correlationId = generateCorrelationId("pw_req");
  const cleanEmail = email.trim().toLowerCase();

  try {
    const userRecords = await db
      .select({ id: users.id, name: users.name, email: users.email, status: users.status })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (userRecords.length === 0 || userRecords[0].status !== "ACTIVE") {
      // Return safe message without user enumeration
      return {
        success: true,
        message: "If your work email is registered, password reset instructions have been generated.",
        correlationId,
      };
    }

    const user = userRecords[0];
    const rawToken = `pw_rst_${randomBytes(24).toString("hex")}`;
    const tokenHash = hashResetToken(rawToken);
    const now = Date.now();
    const expiresAt = now + RESET_TOKEN_TTL_MS;

    // Invalidate previous reset tokens for this user
    await rawClient.execute({
      sql: `UPDATE password_reset_tokens SET is_used = 1 WHERE user_id = ? AND is_used = 0;`,
      args: [user.id],
    });

    // Persist new token
    await rawClient.execute({
      sql: `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, is_used, created_at)
            VALUES (?, ?, ?, ?, 0, ?);`,
      args: [`prt_${randomBytes(12).toString("hex")}`, user.id, tokenHash, expiresAt, now],
    });

    // Audit log
    await logAuditEvent({
      actorUserId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      targetEntity: "users",
      targetId: user.id,
      changes: { email: user.email },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    const isDev = process.env.NODE_ENV !== "production";

    return {
      success: true,
      message: "If your work email is registered, password reset instructions have been generated.",
      devResetToken: isDev ? rawToken : undefined,
      correlationId,
    };
  } catch (err: any) {
    logSecureError("requestPasswordReset", err, { email: cleanEmail }, correlationId);
    return {
      success: false,
      message: "Unable to initiate password reset at this time. Please try again.",
      correlationId,
    };
  }
}

/**
 * Confirms and executes password reset using a valid, unexpired reset token.
 * Updates password using bcrypt cost factor 12 and invalidates all existing sessions.
 */
export async function confirmPasswordReset(params: {
  token: string;
  newPassword: string;
  meta?: { ipAddress?: string; userAgent?: string };
}): Promise<PasswordResetConfirmResult> {
  const correlationId = generateCorrelationId("pw_cnf");
  const { token, newPassword, meta } = params;

  if (!token || !newPassword) {
    return {
      success: false,
      message: "Reset token and new password are required.",
      correlationId,
    };
  }

  const complexity = validatePasswordComplexity(newPassword);
  if (!complexity.valid) {
    return {
      success: false,
      message: complexity.error || "Password does not meet complexity standards.",
      correlationId,
    };
  }

  try {
    const tokenHash = hashResetToken(token);
    const tokenRecords = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (tokenRecords.length === 0) {
      return {
        success: false,
        message: "Invalid or expired password reset token.",
        correlationId,
      };
    }

    const resetRow = tokenRecords[0];
    const now = Date.now();

    if (resetRow.isUsed === 1) {
      return {
        success: false,
        message: "This password reset token has already been used.",
        correlationId,
      };
    }

    if (now > resetRow.expiresAt) {
      return {
        success: false,
        message: "Password reset token has expired. Please request a new one.",
        correlationId,
      };
    }

    // Atomic consumption
    const consumeRes = await rawClient.execute({
      sql: `UPDATE password_reset_tokens SET is_used = 1 WHERE id = ? AND is_used = 0;`,
      args: [resetRow.id],
    });

    if (consumeRes.rowsAffected === 0) {
      return {
        success: false,
        message: "This reset token has already been consumed.",
        correlationId,
      };
    }

    // Hash new password using bcrypt cost factor 12
    const passwordHash = await hashPassword(newPassword, 12);

    // Update credentials
    await rawClient.execute({
      sql: `UPDATE user_credentials 
            SET password_hash = ?, password_updated_at = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = ?
            WHERE user_id = ?;`,
      args: [passwordHash, now, now, resetRow.userId],
    });

    // Invalidate all active sessions for security
    await rawClient.execute({
      sql: `UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL;`,
      args: [now, resetRow.userId],
    });

    // Audit log
    await logAuditEvent({
      actorUserId: resetRow.userId,
      action: "PASSWORD_RESET_COMPLETED",
      targetEntity: "users",
      targetId: resetRow.userId,
      changes: { resetMethod: "TOKEN_VERIFICATION" },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      message: "Password updated successfully. Please sign in with your new credentials.",
      correlationId,
    };
  } catch (err: any) {
    logSecureError("confirmPasswordReset", err, {}, correlationId);
    return {
      success: false,
      message: "Unable to complete password reset at this time. Please try again.",
      correlationId,
    };
  }
}

/**
 * Administrative password reset for employees by HR / Admin.
 * Enforces server-side permissions and logs tamper-evident audit trail.
 */
export async function adminResetEmployeePassword(
  session: SessionContext,
  params: {
    employeeIdOrCode: string;
    newPassword?: string;
    meta?: { ipAddress?: string; userAgent?: string };
  }
) {
  const correlationId = generateCorrelationId("adm_pw");
  const { employeeIdOrCode, newPassword, meta } = params;

  const canManage =
    session.isSuperAdmin ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("HR_MANAGER") ||
    session.effectivePermissions.includes("admin.users.manage");

  if (!canManage) {
    throw new Error("UNAUTHORIZED: Insufficient permissions to reset employee passwords.");
  }

  const employee = await resolveEmployee(employeeIdOrCode);
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND: Target employee record not found.");
  }

  const generatedPassword = newPassword || `Mantra@${randomBytes(4).toString("hex")}!`;
  const complexity = validatePasswordComplexity(generatedPassword);
  if (!complexity.valid) {
    throw new Error(`INVALID_PASSWORD: ${complexity.error}`);
  }

  const passwordHash = await hashPassword(generatedPassword, 12);
  const now = Date.now();

  await rawClient.execute({
    sql: `UPDATE user_credentials 
          SET password_hash = ?, password_updated_at = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = ?
          WHERE user_id = ?;`,
    args: [passwordHash, now, now, employee.userId],
  });

  // Revoke active sessions
  await rawClient.execute({
    sql: `UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL;`,
    args: [now, employee.userId],
  });

  await logAuditEvent({
    actorUserId: session.userId,
    actorEmployeeId: session.employeeId,
    action: "ADMIN_PASSWORD_RESET",
    targetEntity: "users",
    targetId: employee.userId,
    changes: {
      targetEmployeeCode: employee.employeeCode,
      resetBy: session.userId,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    success: true,
    temporaryPassword: generatedPassword,
    correlationId,
  };
}
