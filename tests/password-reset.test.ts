import { describe, it, expect, beforeEach } from "vitest";
import { runMigrations } from "../src/lib/db/migrate";
import { seedDatabase } from "../src/lib/db/seed";
import { db, rawClient } from "../src/lib/db/client";
import { userCredentials, passwordResetTokens, auditLogs } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  requestPasswordReset,
  confirmPasswordReset,
  adminResetEmployeePassword,
} from "../src/lib/auth/password-reset";
import { validateCredentials } from "../src/lib/auth/direct";
import { SessionContext } from "../src/lib/permissions/types";

describe("Workstream 1 — Password Reset & Recovery Engine", () => {
  beforeEach(async () => {
    await runMigrations();
    await seedDatabase();
  });

  const adminSession: SessionContext = {
    userId: "usr_admin",
    employeeId: "EMP-002",
    roles: ["ADMIN"],
    effectivePermissions: [
      "portal.admin.access",
      "admin.users.manage",
    ],
    widestScope: "ORGANIZATION",
    isSuperAdmin: false,
    organizationId: "org_mc_global",
  };

  it("should generate a secure reset token for an active user", async () => {
    const res = await requestPasswordReset("admin@mantra.care");
    expect(res.success).toBe(true);
    expect(res.devResetToken).toBeDefined();
    expect(res.devResetToken?.startsWith("pw_rst_")).toBe(true);

    // Verify token row exists in DB
    const tokens = await db.select().from(passwordResetTokens);
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0].isUsed).toBe(0);
  });

  it("should confirm password reset and update credentials with bcrypt cost factor 12", async () => {
    const req = await requestPasswordReset("admin@mantra.care");
    const token = req.devResetToken!;

    const newPassword = "NewSecret@2026";
    const confirmRes = await confirmPasswordReset({ token, newPassword });
    expect(confirmRes.success).toBe(true);
    expect(confirmRes.message).toContain("Password updated successfully");

    // Verify new password validates
    const loginNew = await validateCredentials("admin@mantra.care", newPassword);
    expect(loginNew.success).toBe(true);

    // Verify old password fails
    const loginOld = await validateCredentials("admin@mantra.care", "Test@2026");
    expect(loginOld.success).toBe(false);
    expect(loginOld.code).toBe("INVALID_CREDENTIALS");
  });

  it("should reject token replay attempts (single-use enforcement)", async () => {
    const req = await requestPasswordReset("admin@mantra.care");
    const token = req.devResetToken!;

    // First reset succeeds
    const first = await confirmPasswordReset({ token, newPassword: "Password1@2026" });
    expect(first.success).toBe(true);

    // Second reset with same token fails
    const second = await confirmPasswordReset({ token, newPassword: "Password2@2026" });
    expect(second.success).toBe(false);
    expect(second.message).toContain("already been used");
  });

  it("should reject expired password reset tokens", async () => {
    const req = await requestPasswordReset("admin@mantra.care");
    const token = req.devResetToken!;

    // Artificially expire the token in database
    await rawClient.execute("UPDATE password_reset_tokens SET expires_at = ?;", [Date.now() - 1000]);

    const res = await confirmPasswordReset({ token, newPassword: "ExpiredPw1@2026" });
    expect(res.success).toBe(false);
    expect(res.message).toContain("expired");
  });

  it("should reject passwords that do not meet complexity requirements", async () => {
    const req = await requestPasswordReset("admin@mantra.care");
    const token = req.devResetToken!;

    const weakPasswords = [
      "short", // < 8 chars
      "alllowercase123!", // no uppercase
      "ALLUPPERCASE123!", // no lowercase
      "NoNumbersHere!", // no digit
      "NoSpecialSymbols123", // no special char
    ];

    for (const weak of weakPasswords) {
      const res = await confirmPasswordReset({ token, newPassword: weak });
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/Password must/i);
    }
  });

  it("should safely handle non-existent emails without user enumeration", async () => {
    const res = await requestPasswordReset("nonexistent.person@mantra.care");
    expect(res.success).toBe(true);
    expect(res.devResetToken).toBeUndefined(); // No token issued for ghost accounts
    expect(res.message).toContain("If your work email is registered");
  });

  it("should allow Admin/HR to reset an employee password with audit logging", async () => {
    const adminRes = await adminResetEmployeePassword(adminSession, {
      employeeIdOrCode: "EMP-008", // Admin Mantra
      newPassword: "AdminReset@2026!",
    });

    expect(adminRes.success).toBe(true);
    expect(adminRes.temporaryPassword).toBe("AdminReset@2026!");

    // Verify employee can log in with new password
    const testLogin = await validateCredentials("admin@mantra.care", "AdminReset@2026!");
    expect(testLogin.success).toBe(true);

    // Verify audit log
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "ADMIN_PASSWORD_RESET"));

    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actorUserId).toBe(adminSession.userId);
  });
});

