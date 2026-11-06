import { describe, it, expect } from "vitest";
import { checkStartupReadiness, REQUIRED_INDEX_NAMES } from "../src/lib/db/readiness";
import {
  sanitizeUserFacingError,
  redactSensitiveData,
  logSecureError,
  generateCorrelationId,
} from "../src/lib/security/safe-logger";

describe("Strict Read-Only Startup Readiness & Security Hardening", () => {
  it("checkStartupReadiness() should perform strictly read-only inspection without executing DDL", async () => {
    const report = await checkStartupReadiness();
    expect(report.dbConnected).toBe(true);
    expect(report.schemaValid).toBe(true);
    expect(report.missingTables).toHaveLength(0);
    expect(report.missingColumns).toHaveLength(0);
    expect(report.missingIndexes).toHaveLength(0);
    expect(report.indexesReady).toBe(true);
    expect(report.migrationHistoryVerified).toBe(true);
  });

  describe("Allowlist-based sanitizeUserFacingError()", () => {
    it("should allow exact authorized safe user messages", () => {
      const safeMsg = "Invalid work email or password.";
      expect(sanitizeUserFacingError(safeMsg)).toBe(safeMsg);

      const lockMsg = "Account temporarily locked due to multiple failed attempts. Please try again later.";
      expect(sanitizeUserFacingError(lockMsg)).toBe(lockMsg);

      const otpReqMsg = "Verification token and code are required.";
      expect(sanitizeUserFacingError(otpReqMsg)).toBe(otpReqMsg);
    });

    it("should allow safe parameterized patterns (e.g. attempt counters)", () => {
      const dynamicOtpMsg = "Invalid verification code. 2 attempts remaining.";
      expect(sanitizeUserFacingError(dynamicOtpMsg)).toBe(dynamicOtpMsg);

      const pwdPolicyMsg = "Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and symbols.";
      expect(sanitizeUserFacingError(pwdPolicyMsg)).toBe(pwdPolicyMsg);
    });

    it("should reject unknown raw exception messages and return fallback", () => {
      const rawException = "TypeError: Cannot read properties of undefined (reading 'token')";
      expect(sanitizeUserFacingError(rawException)).toBe(
        "Unable to complete sign-in right now. Please try again."
      );

      const connectionReset = "LibsqlError: connection reset by peer at 127.0.0.1:8080";
      expect(sanitizeUserFacingError(connectionReset)).toBe(
        "Unable to complete sign-in right now. Please try again."
      );
    });

    it("should reject SQL queries, tables, and parameters and return custom fallback", () => {
      const sqlError = "Failed query: insert into \"otp_challenges\" (\"id\", \"user_id\") values ('123', 'admin')";
      expect(sanitizeUserFacingError(sqlError, "Fallback safe error")).toBe("Fallback safe error");

      const pragmaError = "PRAGMA table_info(employees) error: disk I/O error";
      expect(sanitizeUserFacingError(pragmaError)).toBe(
        "Unable to complete sign-in right now. Please try again."
      );
    });
  });

  describe("Strengthened redactSensitiveData()", () => {
    it("should redact SQL parameter values and argument arrays", () => {
      const sqlLog = 'Failed query: insert into "users" values (?, ?) params: ["karan@mantra.care", "Secret123!"]';
      const redacted = redactSensitiveData(sqlLog);
      expect(redacted).not.toContain("Secret123!");
      expect(redacted).not.toContain("karan@mantra.care");
      expect(redacted).toContain("params: [REDACTED]");
    });

    it("should redact email addresses in error messages", () => {
      const msg = "Failed sending OTP to user test.employee@mantracare.com via SMTP";
      const redacted = redactSensitiveData(msg);
      expect(redacted).not.toContain("test.employee@mantracare.com");
      expect(redacted).toContain("[REDACTED_EMAIL]");
    });

    it("should redact 6-digit OTP codes and challenge hex tokens", () => {
      const log = "Generated OTP 849201 for challenge otp_2cb98c3d4697c75fc542d06b200a13a5";
      const redacted = redactSensitiveData(log);
      expect(redacted).not.toContain("849201");
      expect(redacted).not.toContain("2cb98c3d4697c75fc542d06b200a13a5");
      expect(redacted).toContain("[REDACTED_OTP]");
      expect(redacted).toContain("otp_[REDACTED]");
    });

    it("should redact bcrypt hashes and session cookies", () => {
      const log = "Verified hash $2b$12$e743c265c63ad6891102a4bf91e75ca155f190581b128f5f4 for cookie mc_payroll_session=sess_abc1234567890abcdef1234567890abcdef";
      const redacted = redactSensitiveData(log);
      expect(redacted).not.toContain("$2b$12$e743c265c63ad6891102a4bf91e75ca155f190581b128f5f4");
      expect(redacted).toContain("$2b$12$[REDACTED_BCRYPT]");
      expect(redacted).toContain("mc_payroll_session=[REDACTED]");
    });

    it("should redact confidential employee national IDs and phone numbers", () => {
      const log = "PAN: ABCDE1234F, Aadhaar: 1234 5678 9012, SSN: 123-45-6789, Phone: +91 9876543210";
      const redacted = redactSensitiveData(log);
      expect(redacted).not.toContain("ABCDE1234F");
      expect(redacted).not.toContain("1234 5678 9012");
      expect(redacted).not.toContain("123-45-6789");
      expect(redacted).not.toContain("9876543210");
      expect(redacted).toContain("[REDACTED_PAN]");
      expect(redacted).toContain("[REDACTED_AADHAAR]");
      expect(redacted).toContain("[REDACTED_SSN]");
      expect(redacted).toContain("[REDACTED_PHONE]");
    });

    it("should deeply redact sensitive object structures", () => {
      const sensitiveObj = {
        email: "admin@mantra.care",
        password: "SuperSecretPassword!",
        basicSalary: 85000,
        bankAccountNumber: "987654321012",
        nested: {
          token: "secret_token_123",
          otp: "654321",
        },
      };
      const redacted = redactSensitiveData(sensitiveObj);
      expect(redacted.email).toBe("[REDACTED]");
      expect(redacted.password).toBe("[REDACTED]");
      expect(redacted.basicSalary).toBe("[REDACTED]");
      expect(redacted.bankAccountNumber).toBe("[REDACTED]");
      expect(redacted.nested.token).toBe("[REDACTED]");
      expect(redacted.nested.otp).toBe("[REDACTED]");
    });
  });
});

