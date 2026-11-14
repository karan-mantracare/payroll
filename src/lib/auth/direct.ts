import { randomBytes } from "crypto";
import { db, rawClient } from "../db/client";
import { users, employees, userCredentials, otpChallenges, userRoles } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { verifyPassword, hashPassword } from "../security/password";
import {
  generateSecureOtp,
  hashOtp,
  verifyOtpHash,
  maskEmail,
  isStaticDevOtpAllowed,
  getOtpDeliveryProvider,
} from "./otp";
import { createSession } from "./session";
import { resolveUserPermissions } from "../permissions/evaluator";
import { RoleKey } from "../permissions/types";
import { logAuditEvent } from "../audit/logger";
import { generateCorrelationId, logSecureError } from "../security/safe-logger";

const MAX_FAILED_ATTEMPTS = parseInt(process.env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS || "5", 10);
const LOCKOUT_DURATION_MS = parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MINUTES || "15", 10) * 60 * 1000;
const OTP_TTL_MS = parseInt(process.env.OTP_EXPIRY_SECONDS || "900", 10) * 1000;
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10);

export interface DirectAuthResult {
  success: boolean;
  code?: string;
  error?: string;
  challengeToken?: string;
  emailMasked?: string;
  expiresAt?: number;
  isDevStaticEnabled?: boolean;
  correlationId?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  code?: string;
  error?: string;
  sessionId?: string;
  redirectUrl?: string;
  correlationId?: string;
  user?: {
    id: string;
    employeeId?: string;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
    widestScope?: string;
    isSuperAdmin?: boolean;
  };
}

/**
 * Validates user credentials, enforcing account lockouts, user active status,
 * and authoritative Employee Master mapping.
 */
export async function validateCredentials(email: string, password: string) {
  const correlationId = generateCorrelationId("val_cred");

  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return {
      success: false,
      code: "INVALID_CREDENTIALS",
      error: "Please provide both email and password.",
      correlationId,
    };
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Fetch user by email
    const userRecords = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (userRecords.length === 0) {
      // Avoid user enumeration
      return {
        success: false,
        code: "INVALID_CREDENTIALS",
        error: "Invalid email or password.",
        correlationId,
      };
    }

    const user = userRecords[0];

    // 2. Verify user active status
    if (user.status !== "ACTIVE") {
      return {
        success: false,
        code: "ACCOUNT_INACTIVE",
        error: "Your user account is inactive. Please contact HR administration.",
        correlationId,
      };
    }

    // 3. Resolve linked Employee Master record (authoritative identity & status)
    const employeeRecords = await db
      .select()
      .from(employees)
      .where(eq(employees.userId, user.id))
      .limit(1);

    if (employeeRecords.length === 0) {
      return {
        success: false,
        code: "EMPLOYEE_NOT_MAPPED",
        error: "No linked Employee Master record found. Please contact HR administration.",
        correlationId,
      };
    }

    const emp = employeeRecords[0];

    if (emp.status !== "ACTIVE") {
      return {
        success: false,
        code: "EMPLOYEE_INACTIVE",
        error: "Employee profile is inactive or terminated. Access denied.",
        correlationId,
      };
    }

    // 4. Fetch user credentials
    const credRecords = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, user.id))
      .limit(1);

    if (credRecords.length === 0) {
      return {
        success: false,
        code: "CREDENTIALS_NOT_FOUND",
        error: "Account credentials have not been configured. Please activate your account.",
        correlationId,
      };
    }

    const creds = credRecords[0];
    const now = Date.now();

    // 5. Check account lockout
    if (creds.lockedUntil && creds.lockedUntil > now) {
      const remainingMinutes = Math.ceil((creds.lockedUntil - now) / 60000);
      return {
        success: false,
        code: "ACCOUNT_LOCKED",
        error: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
        correlationId,
      };
    }

    // 6. Verify password with bcrypt
    const isMatch = await verifyPassword(password, creds.passwordHash);

    if (!isMatch) {
      const failedAttempts = creds.failedLoginAttempts + 1;
      const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = shouldLock ? now + LOCKOUT_DURATION_MS : null;

      await db
        .update(userCredentials)
        .set({
          failedLoginAttempts: failedAttempts,
          lockedUntil,
          updatedAt: now,
        })
        .where(eq(userCredentials.id, creds.id));

      if (shouldLock) {
        return {
          success: false,
          code: "ACCOUNT_LOCKED",
          error: "Account is temporarily locked due to multiple failed login attempts. Please try again later.",
          correlationId,
        };
      }

      return {
        success: false,
        code: "INVALID_CREDENTIALS",
        error: "Invalid email or password.",
        correlationId,
      };
    }

    // 7. Password matched: reset failed login attempts if necessary
    if (creds.failedLoginAttempts > 0 || creds.lockedUntil !== null) {
      await db
        .update(userCredentials)
        .set({
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: now,
        })
        .where(eq(userCredentials.id, creds.id));
    }

    return {
      success: true,
      user,
      employee: emp,
      correlationId,
    };
  } catch (err: any) {
    logSecureError("validateCredentials.dbError", err, { email: cleanEmail }, correlationId);
    return {
      success: false,
      code: "DATABASE_UNAVAILABLE",
      error: "Authentication service temporarily unavailable. Please try again.",
      correlationId,
    };
  }
}

/**
 * Initiates direct login by validating email/password and issuing a secure OTP challenge.
 * Enforces atomic challenge replacement and fails closed if persistence fails.
 */
export async function initiateLoginChallenge(
  email: string,
  password: string
): Promise<DirectAuthResult> {
  const correlationId = generateCorrelationId("auth_init");

  try {
    const validation = await validateCredentials(email, password);

    if (!validation.success || !validation.user || !validation.employee) {
      return {
        success: false,
        code: validation.code,
        error: validation.error,
        correlationId: validation.correlationId || correlationId,
      };
    }

    const { user } = validation;
    const now = Date.now();
    const expiresAt = now + OTP_TTL_MS;

    // Generate cryptographically secure 6-digit OTP and keyed HMAC hash
    const otp = generateSecureOtp();
    const otpHash = hashOtp(otp);
    const challengeToken = randomBytes(32).toString("hex");
    const challengeId = `otp_${randomBytes(16).toString("hex")}`;

    // 1. Invalidate any previous unconsumed challenges for this user atomically
    try {
      await rawClient.execute({
        sql: `UPDATE otp_challenges SET is_used = 1 WHERE user_id = ? AND is_used = 0;`,
        args: [user.id],
      });
    } catch (err: any) {
      logSecureError("initiateLoginChallenge.invalidatePrevious", err, { userId: user.id }, correlationId);
    }

    // 2. Persist new challenge in database
    try {
      await rawClient.execute({
        sql: `INSERT INTO otp_challenges (id, user_id, challenge_token, otp_hash, expires_at, attempts, max_attempts, is_used, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          challengeId,
          user.id,
          challengeToken,
          otpHash,
          expiresAt,
          0,
          OTP_MAX_ATTEMPTS,
          0,
          now,
        ],
      });
    } catch (insertErr: any) {
      logSecureError("initiateLoginChallenge.insert", insertErr, { userId: user.id }, correlationId);
      return {
        success: false,
        code: "CHALLENGE_PERSISTENCE_FAILED",
        error: "Unable to complete sign-in right now. Please try again.",
        correlationId,
      };
    }

    // 3. Dispatch OTP via pluggable delivery provider ONLY AFTER persistence confirmed
    const provider = getOtpDeliveryProvider();
    const delivery = await provider.sendOtp({
      email: user.email,
      otp,
      challengeId,
      userName: user.name,
      expiryMinutes: "15 min",
      companyName: "Mantra Group",
    });

    if (!delivery.success) {
      logSecureError(
        "initiateLoginChallenge.deliveryFailed",
        new Error(delivery.error || "OTP delivery failed"),
        { userId: user.id, provider: delivery.provider },
        correlationId
      );
      if (!isStaticDevOtpAllowed()) {
        return {
          success: false,
          code: "OTP_DELIVERY_FAILED",
          error: "Unable to dispatch verification email. Please try again or contact support.",
          correlationId,
        };
      }
    }

    return {
      success: true,
      challengeToken,
      emailMasked: maskEmail(user.email),
      expiresAt,
      isDevStaticEnabled: isStaticDevOtpAllowed(),
      correlationId,
    };
  } catch (err: any) {
    logSecureError("initiateLoginChallenge.unhandled", err, {}, correlationId);
    return {
      success: false,
      code: "AUTH_SERVICE_ERROR",
      error: "Unable to complete sign-in right now. Please try again.",
      correlationId,
    };
  }
}

/**
 * Verifies a submitted OTP challenge, checks replay/expiration/attempts,
 * and mints an authenticated session with portal routing.
 * Enforces atomic consumption to prevent simultaneous requests from consuming the same challenge twice.
 */
export async function verifyLoginOtp(params: {
  challengeToken: string;
  otp: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<VerifyOtpResult> {
  const correlationId = generateCorrelationId("auth_verify");
  const { challengeToken, otp, ipAddress, userAgent } = params;

  if (!challengeToken || !otp || typeof challengeToken !== "string" || typeof otp !== "string") {
    return {
      success: false,
      code: "INVALID_PARAMETERS",
      error: "Verification token and code are required.",
      correlationId,
    };
  }

  const cleanOtp = otp.trim();

  try {
    // 1. Fetch challenge record
    const challengeRecords = await db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.challengeToken, challengeToken))
      .limit(1);

    if (challengeRecords.length === 0) {
      return {
        success: false,
        code: "CHALLENGE_NOT_FOUND",
        error: "Invalid or expired verification session. Please log in again.",
        correlationId,
      };
    }

    const challenge = challengeRecords[0];
    const now = Date.now();

    // 2. Replay check
    if (challenge.isUsed === 1) {
      return {
        success: false,
        code: "CHALLENGE_ALREADY_USED",
        error: "This verification code has already been used. Please log in again.",
        correlationId,
      };
    }

    // 3. Expiration check
    if (now > challenge.expiresAt) {
      return {
        success: false,
        code: "CHALLENGE_EXPIRED",
        error: "Verification code has expired. Please log in again.",
        correlationId,
      };
    }

    // 4. Max attempts check
    if (challenge.attempts >= challenge.maxAttempts) {
      return {
        success: false,
        code: "MAX_ATTEMPTS_EXCEEDED",
        error: "Maximum verification attempts exceeded. Please log in again.",
        correlationId,
      };
    }

    // 5. Increment attempts counter
    const nextAttempts = challenge.attempts + 1;
    await db
      .update(otpChallenges)
      .set({ attempts: nextAttempts })
      .where(eq(otpChallenges.id, challenge.id));

    // 6. Validate OTP (Static dev OTP 123456 only in development + enabled flag, or HMAC comparison)
    const isDevStaticMatch = isStaticDevOtpAllowed() && cleanOtp === "123456";
    const isHmacMatch = verifyOtpHash(cleanOtp, challenge.otpHash);

    if (!isDevStaticMatch && !isHmacMatch) {
      if (nextAttempts >= challenge.maxAttempts) {
        return {
          success: false,
          code: "MAX_ATTEMPTS_EXCEEDED",
          error: "Maximum verification attempts exceeded. Please log in again.",
          correlationId,
        };
      }

      return {
        success: false,
        code: "INVALID_OTP",
        error: "Invalid verification code. Please check and try again.",
        correlationId,
      };
    }

    // 7. Atomic consumption to strictly prevent concurrent duplicate submissions
    const updateRes = await rawClient.execute({
      sql: `UPDATE otp_challenges SET is_used = 1 WHERE id = ? AND is_used = 0;`,
      args: [challenge.id],
    });

    if (updateRes.rowsAffected === 0) {
      return {
        success: false,
        code: "CONCURRENT_CONSUMPTION_PREVENTED",
        error: "This verification code has already been consumed. Please log in again.",
        correlationId,
      };
    }

    // 8. Fetch user & linked Employee Master
    const userRecords = await db
      .select()
      .from(users)
      .where(and(eq(users.id, challenge.userId), eq(users.status, "ACTIVE")))
      .limit(1);

    if (userRecords.length === 0) {
      return {
        success: false,
        code: "ACCOUNT_INACTIVE",
        error: "User account is no longer active.",
        correlationId,
      };
    }

    const user = userRecords[0];

    const empRecords = await db
      .select()
      .from(employees)
      .where(and(eq(employees.userId, user.id), eq(employees.status, "ACTIVE")))
      .limit(1);

    if (empRecords.length === 0) {
      return {
        success: false,
        code: "EMPLOYEE_INACTIVE",
        error: "Active employee profile required. Access denied.",
        correlationId,
      };
    }

    const emp = empRecords[0];

    // 9. Resolve roles and permissions
    const assignedRoles = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, user.id));

    const roleKeys = assignedRoles.map((r) => r.roleKey as RoleKey);
    const { effectivePermissions, widestScope, isSuperAdmin } = resolveUserPermissions(roleKeys);

    const canAccessAdmin = isSuperAdmin || effectivePermissions.has("portal.admin.access");
    const canAccessEmployee = isSuperAdmin || effectivePermissions.has("portal.employee.access");

    if (!canAccessAdmin && !canAccessEmployee) {
      return {
        success: false,
        code: "PORTAL_ACCESS_DENIED",
        error: "Access denied. Your account does not have permission to access any portal.",
        correlationId,
      };
    }

    // Determine authorized destination
    const redirectUrl = canAccessAdmin ? "/payroll/admin" : "/payroll/dash";

    // 10. Mint authenticated server session
    const tokenHash = hashOtp(challengeToken);
    const sessionId = await createSession(user.id, tokenHash, ipAddress, userAgent);

    // 11. Log audit event
    await logAuditEvent({
      actorUserId: user.id,
      actorEmployeeId: emp.id,
      action: "USER_LOGIN_DIRECT_OTP",
      targetEntity: "users",
      targetId: user.id,
      changes: {
        authMethod: "DIRECT_EMAIL_OTP",
        email: user.email,
        roles: roleKeys,
        ipAddress,
      },
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      sessionId,
      redirectUrl,
      correlationId,
      user: {
        id: user.id,
        employeeId: emp.id,
        name: user.name,
        email: user.email,
        roles: roleKeys,
        permissions: Array.from(effectivePermissions),
        widestScope,
        isSuperAdmin,
      },
    };
  } catch (err: any) {
    logSecureError("verifyLoginOtp.unhandled", err, {}, correlationId);
    return {
      success: false,
      code: "AUTH_VERIFY_ERROR",
      error: "Unable to complete verification at this time. Please try again.",
      correlationId,
    };
  }
}

/**
 * Account activation / credential creation helper for inviting new employees.
 */
export async function setEmployeeCredentials(params: {
  userId: string;
  plaintextPassword: string;
}): Promise<void> {
  const { userId, plaintextPassword } = params;
  const passwordHash = await hashPassword(plaintextPassword, 12);
  const now = Date.now();

  const existing = await db
    .select()
    .from(userCredentials)
    .where(eq(userCredentials.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(userCredentials)
      .set({
        passwordHash,
        passwordUpdatedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
      })
      .where(eq(userCredentials.userId, userId));
  } else {
    await db.insert(userCredentials).values({
      id: `cred_${userId}`,
      userId,
      passwordHash,
      passwordUpdatedAt: now,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
