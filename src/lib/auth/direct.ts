import { randomBytes } from "crypto";
import { db } from "../db/client";
import { users, employees, userCredentials, otpChallenges, userRoles } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
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

const MAX_FAILED_ATTEMPTS = parseInt(process.env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS || "5", 10);
const LOCKOUT_DURATION_MS = parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MINUTES || "15", 10) * 60 * 1000;
const OTP_TTL_MS = parseInt(process.env.OTP_EXPIRY_SECONDS || "300", 10) * 1000;
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10);

export interface DirectAuthResult {
  success: boolean;
  code?: string;
  error?: string;
  challengeToken?: string;
  emailMasked?: string;
  expiresAt?: number;
  isDevStaticEnabled?: boolean;
}

export interface VerifyOtpResult {
  success: boolean;
  code?: string;
  error?: string;
  sessionId?: string;
  redirectUrl?: string;
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
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return {
      success: false,
      code: "INVALID_CREDENTIALS",
      error: "Please provide both email and password.",
    };
  }

  const cleanEmail = email.trim().toLowerCase();

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
    };
  }

  const user = userRecords[0];

  // 2. Verify user active status
  if (user.status !== "ACTIVE") {
    return {
      success: false,
      code: "ACCOUNT_INACTIVE",
      error: "Your user account is inactive. Please contact HR administration.",
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
    };
  }

  const emp = employeeRecords[0];

  if (emp.status !== "ACTIVE") {
    return {
      success: false,
      code: "EMPLOYEE_INACTIVE",
      error: "Employee profile is inactive or terminated. Access denied.",
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
      };
    }

    return {
      success: false,
      code: "INVALID_CREDENTIALS",
      error: "Invalid email or password.",
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
  };
}

/**
 * Initiates direct login by validating email/password and issuing a secure OTP challenge.
 */
export async function initiateLoginChallenge(
  email: string,
  password: string
): Promise<DirectAuthResult> {
  const validation = await validateCredentials(email, password);

  if (!validation.success || !validation.user || !validation.employee) {
    return {
      success: false,
      code: validation.code,
      error: validation.error,
    };
  }

  const { user, employee } = validation;
  const now = Date.now();
  const expiresAt = now + OTP_TTL_MS;

  // Generate cryptographically secure 6-digit OTP and keyed HMAC hash
  const otp = generateSecureOtp();
  const otpHash = hashOtp(otp);
  const challengeToken = randomBytes(32).toString("hex");
  const challengeId = `otp_${randomBytes(16).toString("hex")}`;

  // Persist challenge in database
  await db.insert(otpChallenges).values({
    id: challengeId,
    userId: user.id,
    challengeToken,
    otpHash,
    expiresAt,
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    isUsed: 0,
    createdAt: now,
  });

  // Dispatch OTP via pluggable delivery provider
  const provider = getOtpDeliveryProvider();
  await provider.sendOtp({
    email: user.email,
    otp,
    challengeId,
    userName: user.name,
  });

  return {
    success: true,
    challengeToken,
    emailMasked: maskEmail(user.email),
    expiresAt,
    isDevStaticEnabled: isStaticDevOtpAllowed(),
  };
}

/**
 * Verifies a submitted OTP challenge, checks replay/expiration/attempts,
 * and mints an authenticated session with portal routing.
 */
export async function verifyLoginOtp(params: {
  challengeToken: string;
  otp: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<VerifyOtpResult> {
  const { challengeToken, otp, ipAddress, userAgent } = params;

  if (!challengeToken || !otp || typeof challengeToken !== "string" || typeof otp !== "string") {
    return {
      success: false,
      code: "INVALID_PARAMETERS",
      error: "Verification token and code are required.",
    };
  }

  const cleanOtp = otp.trim();

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
    };
  }

  // 3. Expiration check
  if (now > challenge.expiresAt) {
    return {
      success: false,
      code: "CHALLENGE_EXPIRED",
      error: "Verification code has expired. Please log in again.",
    };
  }

  // 4. Max attempts check
  if (challenge.attempts >= challenge.maxAttempts) {
    return {
      success: false,
      code: "MAX_ATTEMPTS_EXCEEDED",
      error: "Maximum verification attempts exceeded. Please log in again.",
    };
  }

  // 5. Increment attempts counter
  const nextAttempts = challenge.attempts + 1;
  await db
    .update(otpChallenges)
    .set({ attempts: nextAttempts })
    .where(eq(otpChallenges.id, challenge.id));

  // 6. Validate OTP (Static dev OTP 123456 only in development + enabled flag, or cryptographic HMAC comparison)
  const isDevStaticMatch = isStaticDevOtpAllowed() && cleanOtp === "123456";
  const isHmacMatch = verifyOtpHash(cleanOtp, challenge.otpHash);

  if (!isDevStaticMatch && !isHmacMatch) {
    if (nextAttempts >= challenge.maxAttempts) {
      return {
        success: false,
        code: "MAX_ATTEMPTS_EXCEEDED",
        error: "Maximum verification attempts exceeded. Please log in again.",
      };
    }

    return {
      success: false,
      code: "INVALID_OTP",
      error: "Invalid verification code. Please check and try again.",
    };
  }

  // 7. Successful verification: Mark challenge as used immediately
  await db
    .update(otpChallenges)
    .set({ isUsed: 1 })
    .where(eq(otpChallenges.id, challenge.id));

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
    };
  }

  // Determine authorized destination
  const redirectUrl = canAccessAdmin ? "/payrol/admin" : "/payrol/dash";

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

