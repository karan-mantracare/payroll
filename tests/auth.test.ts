import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  validateCredentials,
  initiateLoginChallenge,
  verifyLoginOtp,
  setEmployeeCredentials,
} from "../src/lib/auth/direct";
import {
  assertValidOtpConfig,
  isStaticDevOtpAllowed,
  hashOtp,
  verifyOtpHash,
  generateSecureOtp,
  maskEmail,
} from "../src/lib/auth/otp";
import { getSessionContext, revokeSession } from "../src/lib/auth/session";
import { seedDatabase } from "../src/lib/db/seed";
import { rawClient } from "../src/lib/db/client";
import { db } from "../src/lib/db/client";
import { users, employees, userCredentials, otpChallenges, userRoles } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

describe("Direct Email/Password Authentication & Two-Factor OTP Engine", () => {
  beforeAll(async () => {
    process.env.ALLOW_DESTRUCTIVE_SEED = "true";
    process.env.NODE_ENV = "development";
    process.env.PAYROLL_DEV_STATIC_OTP_ENABLED = "true";
    await seedDatabase();
  });

  beforeEach(async () => {
    // Clean dynamic auth records before each test
    await rawClient.execute("DELETE FROM auth_sessions;");
    await rawClient.execute("DELETE FROM otp_challenges;");
    await rawClient.execute("UPDATE user_credentials SET failed_login_attempts = 0, locked_until = NULL;");
  });

  describe("1. Password Authentication & Credential Verification", () => {
    it("should successfully authenticate valid email and password", async () => {
      const res = await validateCredentials("admin@mantracare.com", "MantraCare@2026!");
      expect(res.success).toBe(true);
      expect(res.user?.email).toBe("admin@mantracare.com");
      expect(res.employee?.id).toBe("EMP-002");
    });

    it("should reject invalid password with generic error and increment failed attempts", async () => {
      const res = await validateCredentials("admin@mantracare.com", "WrongPassword123!");
      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_CREDENTIALS");
      expect(res.error).toBe("Invalid email or password.");

      const creds = await db
        .select()
        .from(userCredentials)
        .where(eq(userCredentials.userId, "usr_admin"));
      expect(creds[0].failedLoginAttempts).toBe(1);
    });

    it("should reject unknown user with generic error without user enumeration", async () => {
      const res = await validateCredentials("ghost.user@mantracare.com", "AnyPassword123!");
      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_CREDENTIALS");
      expect(res.error).toBe("Invalid email or password.");
    });

    it("should enforce account lockout after 5 consecutive failed attempts", async () => {
      const targetEmail = "hrmanager@mantracare.com";

      // 4 failed attempts
      for (let i = 0; i < 4; i++) {
        const attempt = await validateCredentials(targetEmail, "WrongPass!");
        expect(attempt.success).toBe(false);
        expect(attempt.code).toBe("INVALID_CREDENTIALS");
      }

      // 5th failed attempt triggers lockout
      const fifthAttempt = await validateCredentials(targetEmail, "WrongPass!");
      expect(fifthAttempt.success).toBe(false);
      expect(fifthAttempt.code).toBe("ACCOUNT_LOCKED");

      // Subsequent attempt even with correct password is now blocked
      const blockedAttempt = await validateCredentials(targetEmail, "MantraCare@2026!");
      expect(blockedAttempt.success).toBe(false);
      expect(blockedAttempt.code).toBe("ACCOUNT_LOCKED");
      expect(blockedAttempt.error).toContain("temporarily locked");
    });

    it("should reject inactive user account", async () => {
      await rawClient.execute("UPDATE users SET status = 'INACTIVE' WHERE id = 'usr_employee';");

      const res = await validateCredentials("employee@mantracare.com", "MantraCare@2026!");
      expect(res.success).toBe(false);
      expect(res.code).toBe("ACCOUNT_INACTIVE");

      // Restore user
      await rawClient.execute("UPDATE users SET status = 'ACTIVE' WHERE id = 'usr_employee';");
    });

    it("should reject login if Employee Master mapping is missing", async () => {
      const unmappedUserId = "usr_unmapped_test";
      const now = Date.now();
      await rawClient.execute({
        sql: "INSERT INTO users (id, platform_user_id, email, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?);",
        args: [unmappedUserId, "plt_unmapped_test", "unmapped@mantracare.com", "Unmapped User", now, now],
      });
      await setEmployeeCredentials({ userId: unmappedUserId, plaintextPassword: "MantraCare@2026!" });

      const res = await validateCredentials("unmapped@mantracare.com", "MantraCare@2026!");
      expect(res.success).toBe(false);
      expect(res.code).toBe("EMPLOYEE_NOT_MAPPED");
    });

    it("should reject login if Employee Master record is terminated or inactive", async () => {
      await rawClient.execute("UPDATE employees SET status = 'TERMINATED' WHERE id = 'EMP-006';");

      const res = await validateCredentials("employee@mantracare.com", "MantraCare@2026!");
      expect(res.success).toBe(false);
      expect(res.code).toBe("EMPLOYEE_INACTIVE");

      // Restore employee
      await rawClient.execute("UPDATE employees SET status = 'ACTIVE' WHERE id = 'EMP-006';");
    });
  });

  describe("2. OTP Challenge Generation & Initiation", () => {
    it("should initiate OTP challenge and mask employee email correctly", async () => {
      const res = await initiateLoginChallenge("admin@mantracare.com", "MantraCare@2026!");
      expect(res.success).toBe(true);
      expect(res.challengeToken).toBeDefined();
      expect(res.emailMasked).toBe("a***n@mantracare.com");
      expect(res.expiresAt).toBeGreaterThan(Date.now());
      expect(res.isDevStaticEnabled).toBe(true);

      // Verify challenge row in database
      const row = await db
        .select()
        .from(otpChallenges)
        .where(eq(otpChallenges.challengeToken, res.challengeToken!));
      expect(row.length).toBe(1);
      expect(row[0].userId).toBe("usr_admin");
      expect(row[0].isUsed).toBe(0);
      expect(row[0].attempts).toBe(0);
    });
  });

  describe("3. Two-Factor OTP Verification", () => {
    it("should successfully verify using development static OTP (123456) when enabled", async () => {
      const challenge = await initiateLoginChallenge("employee@mantracare.com", "MantraCare@2026!");
      expect(challenge.success).toBe(true);

      const verifyRes = await verifyLoginOtp({
        challengeToken: challenge.challengeToken!,
        otp: "123456",
        ipAddress: "127.0.0.1",
        userAgent: "VitestSuite",
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.sessionId).toBeDefined();
      expect(verifyRes.redirectUrl).toBe("/payrol/dash");
      expect(verifyRes.user?.email).toBe("employee@mantracare.com");

      // Ensure challenge is marked as used
      const row = await db
        .select()
        .from(otpChallenges)
        .where(eq(otpChallenges.challengeToken, challenge.challengeToken!));
      expect(row[0].isUsed).toBe(1);
    });

    it("should prevent OTP replay attack when challenge is submitted twice", async () => {
      const challenge = await initiateLoginChallenge("admin@mantracare.com", "MantraCare@2026!");
      expect(challenge.success).toBe(true);

      // First verification succeeds
      const firstVerify = await verifyLoginOtp({
        challengeToken: challenge.challengeToken!,
        otp: "123456",
      });
      expect(firstVerify.success).toBe(true);

      // Replaying the exact same challenge token MUST be rejected
      const replayVerify = await verifyLoginOtp({
        challengeToken: challenge.challengeToken!,
        otp: "123456",
      });
      expect(replayVerify.success).toBe(false);
      expect(replayVerify.code).toBe("CHALLENGE_ALREADY_USED");
    });

    it("should reject incorrect OTP and increment verification attempts", async () => {
      const challenge = await initiateLoginChallenge("admin@mantracare.com", "MantraCare@2026!");
      expect(challenge.success).toBe(true);

      const verifyRes = await verifyLoginOtp({
        challengeToken: challenge.challengeToken!,
        otp: "999999",
      });

      expect(verifyRes.success).toBe(false);
      expect(verifyRes.code).toBe("INVALID_OTP");

      const row = await db
        .select()
        .from(otpChallenges)
        .where(eq(otpChallenges.challengeToken, challenge.challengeToken!));
      expect(row[0].attempts).toBe(1);
    });

    it("should lock challenge after exceeding maximum verification attempts (5 attempts)", async () => {
      const challenge = await initiateLoginChallenge("admin@mantracare.com", "MantraCare@2026!");

      for (let i = 0; i < 4; i++) {
        const attempt = await verifyLoginOtp({
          challengeToken: challenge.challengeToken!,
          otp: "000000",
        });
        expect(attempt.success).toBe(false);
        expect(attempt.code).toBe("INVALID_OTP");
      }

      // 5th failed attempt exhausts challenge
      const fifthAttempt = await verifyLoginOtp({
        challengeToken: challenge.challengeToken!,
        otp: "000000",
      });
      expect(fifthAttempt.success).toBe(false);
      expect(fifthAttempt.code).toBe("MAX_ATTEMPTS_EXCEEDED");

      // Even correct OTP is now rejected because max attempts was exceeded
      const postLockoutAttempt = await verifyLoginOtp({
        challengeToken: challenge.challengeToken!,
        otp: "123456",
      });
      expect(postLockoutAttempt.success).toBe(false);
      expect(postLockoutAttempt.code).toBe("MAX_ATTEMPTS_EXCEEDED");
    });

    it("should reject expired OTP challenge", async () => {
      const challenge = await initiateLoginChallenge("admin@mantracare.com", "MantraCare@2026!");

      // Artificially expire the challenge in DB
      await rawClient.execute({
        sql: "UPDATE otp_challenges SET expires_at = ? WHERE challenge_token = ?;",
        args: [Date.now() - 1000, challenge.challengeToken!],
      });

      const verifyRes = await verifyLoginOtp({
        challengeToken: challenge.challengeToken!,
        otp: "123456",
      });

      expect(verifyRes.success).toBe(false);
      expect(verifyRes.code).toBe("CHALLENGE_EXPIRED");
    });

    it("should correctly verify cryptographically hashed OTP without static dev bypass", async () => {
      const generatedOtp = generateSecureOtp();
      const hashedOtp = hashOtp(generatedOtp);

      const now = Date.now();
      const token = "crypto_test_token_" + now;

      await db.insert(otpChallenges).values({
        id: "otp_test_crypto",
        userId: "usr_admin",
        challengeToken: token,
        otpHash: hashedOtp,
        expiresAt: now + 300000,
        attempts: 0,
        maxAttempts: 5,
        isUsed: 0,
        createdAt: now,
      });

      const verifyRes = await verifyLoginOtp({
        challengeToken: token,
        otp: generatedOtp,
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.sessionId).toBeDefined();
    });
  });

  describe("4. Security & Production Protections", () => {
    it("should throw a fatal configuration error if PAYROLL_DEV_STATIC_OTP_ENABLED is enabled in production", () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origStatic = process.env.PAYROLL_DEV_STATIC_OTP_ENABLED;

      try {
        process.env.NODE_ENV = "production";
        process.env.PAYROLL_DEV_STATIC_OTP_ENABLED = "true";

        expect(() => assertValidOtpConfig()).toThrow(
          /PAYROLL_DEV_STATIC_OTP_ENABLED cannot be enabled in production/
        );

        // isStaticDevOtpAllowed must be false
        expect(isStaticDevOtpAllowed()).toBe(false);
      } finally {
        process.env.NODE_ENV = origNodeEnv;
        process.env.PAYROLL_DEV_STATIC_OTP_ENABLED = origStatic;
      }
    });

    it("should reject static OTP 123456 in production even if submitted", async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origStatic = process.env.PAYROLL_DEV_STATIC_OTP_ENABLED;

      try {
        process.env.NODE_ENV = "production";
        process.env.PAYROLL_DEV_STATIC_OTP_ENABLED = "false";

        const challenge = await initiateLoginChallenge("admin@mantracare.com", "MantraCare@2026!");

        // Submitting 123456 in production must fail
        const res = await verifyLoginOtp({
          challengeToken: challenge.challengeToken!,
          otp: "123456",
        });

        expect(res.success).toBe(false);
        expect(res.code).toBe("INVALID_OTP");
      } finally {
        process.env.NODE_ENV = origNodeEnv;
        process.env.PAYROLL_DEV_STATIC_OTP_ENABLED = origStatic;
      }
    });
  });

  describe("5. Role-Based Portal Routing & Session Lifecycle", () => {
    it("should route user with portal.admin.access to /payrol/admin", async () => {
      const challenge = await initiateLoginChallenge("admin@mantracare.com", "MantraCare@2026!");
      const res = await verifyLoginOtp({
        challengeToken: challenge.challengeToken!,
        otp: "123456",
      });

      expect(res.success).toBe(true);
      expect(res.redirectUrl).toBe("/payrol/admin");
    });

    it("should route user with portal.employee.access only to /payrol/dash", async () => {
      const challenge = await initiateLoginChallenge("employee@mantracare.com", "MantraCare@2026!");
      const res = await verifyLoginOtp({
        challengeToken: challenge.challengeToken!,
        otp: "123456",
      });

      expect(res.success).toBe(true);
      expect(res.redirectUrl).toBe("/payrol/dash");
    });

    it("should properly resolve and revoke session context", async () => {
      const challenge = await initiateLoginChallenge("superadmin@mantracare.com", "MantraCare@2026!");
      const res = await verifyLoginOtp({
        challengeToken: challenge.challengeToken!,
        otp: "123456",
      });

      const sessionId = res.sessionId!;
      const context = await getSessionContext(sessionId);
      expect(context).not.toBeNull();
      expect(context?.email).toBe("superadmin@mantracare.com");
      expect(context?.isSuperAdmin).toBe(true);

      // Revoke session
      await revokeSession(sessionId);

      // Must be null post-revocation
      const revokedContext = await getSessionContext(sessionId);
      expect(revokedContext).toBeNull();
    });
  });
});
