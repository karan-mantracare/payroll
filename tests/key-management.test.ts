import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptField,
  decryptField,
  getKey,
  isValidKeyHex,
  validateEncryptionConfig,
  assertEncryptionReady,
  getActiveKeyVersion,
} from "../src/lib/security/crypto";
import {
  verifyRotationReadiness,
  rotateSensitiveEmployeeDetails,
} from "../src/lib/security/key-migration";
import { seedDatabase } from "../src/lib/db/seed";
import { db, rawClient } from "../src/lib/db/client";

describe("Cryptographic Key Management, Validation & Safe Rotation", () => {
  const originalEnv = { ...process.env };
  const VALID_KEY_V1 = "16653300a8f4b5fd31651ab5e712f66368283ea90db280042d10f382ec4af16a";
  const VALID_KEY_V2 = "54abd47926e62762db1c45bac2259cd138430a1214b9d6bc2bc370512e0956e8";

  beforeEach(() => {
    // Reset to clean test environment
    process.env.PAYROLL_ACTIVE_KEY_VERSION = "v1";
    process.env.PAYROLL_ENCRYPTION_KEY_V1 = VALID_KEY_V1;
    process.env.PAYROLL_ENCRYPTION_KEY_V2 = VALID_KEY_V2;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Key Format & Encoding Validation", () => {
    it("should accept valid 64-character hexadecimal keys", () => {
      expect(isValidKeyHex(VALID_KEY_V1)).toBe(true);
      expect(isValidKeyHex(VALID_KEY_V2)).toBe(true);
    });

    it("should reject keys with invalid lengths", () => {
      expect(isValidKeyHex("")).toBe(false);
      expect(isValidKeyHex("1234567890abcdef")).toBe(false); // 16 chars
      expect(isValidKeyHex(VALID_KEY_V1.slice(0, 63))).toBe(false); // 63 chars
      expect(isValidKeyHex(VALID_KEY_V1 + "0")).toBe(false); // 65 chars
    });

    it("should reject keys containing non-hexadecimal characters", () => {
      // 64 chars, but contains 'z'
      const invalidHex = "z".repeat(64);
      expect(isValidKeyHex(invalidHex)).toBe(false);
      const mixedInvalid = VALID_KEY_V1.slice(0, 60) + "gggg";
      expect(isValidKeyHex(mixedInvalid)).toBe(false);
    });
  });

  describe("Configuration Validation & Fail-Secure Startup", () => {
    it("should report valid configuration when all keys are properly configured", () => {
      const res = validateEncryptionConfig();
      expect(res.isValid).toBe(true);
      expect(res.activeVersion).toBe("v1");
      expect(res.configuredVersions).toContain("v1");
      expect(res.configuredVersions).toContain("v2");
      expect(res.errors).toHaveLength(0);
    });

    it("should fail validation when active key is missing from environment", () => {
      delete process.env.PAYROLL_ENCRYPTION_KEY_V1;
      const res = validateEncryptionConfig();
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes("PAYROLL_ENCRYPTION_KEY_V1"))).toBe(true);
    });

    it("should fail validation when active key has invalid length or non-hex characters", () => {
      process.env.PAYROLL_ENCRYPTION_KEY_V1 = "tooshortkey";
      const res = validateEncryptionConfig();
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes("PAYROLL_ENCRYPTION_KEY_V1"))).toBe(true);
    });

    it("should throw fatal startup error via assertEncryptionReady when config is invalid", () => {
      delete process.env.PAYROLL_ENCRYPTION_KEY_V1;
      expect(() => assertEncryptionReady()).toThrow(/Fatal Encryption Startup Error/);
    });

    it("should pass assertEncryptionReady when config is valid", () => {
      expect(() => assertEncryptionReady()).not.toThrow();
    });
  });

  describe("Zero Fallback Enforcement & Runtime Failure Modes", () => {
    it("should throw immediately and never use fallback keys if active key is undefined", () => {
      delete process.env.PAYROLL_ENCRYPTION_KEY_V1;
      expect(() => encryptField("Sensitive Data", "v1")).toThrow(/CRITICAL SECURITY CONFIGURATION ERROR/);
    });

    it("should throw with explicit data loss warning when decrypting an envelope whose key was removed", () => {
      const encrypted = encryptField("Secret Bank Details", "v1");
      delete process.env.PAYROLL_ENCRYPTION_KEY_V1;

      expect(() => decryptField(encrypted)).toThrow(/Older keys must remain configured in environment variables to prevent permanent data loss/);
    });

    it("should fail encryption when key has invalid hex encoding", () => {
      process.env.PAYROLL_ENCRYPTION_KEY_V1 = "x".repeat(64);
      expect(() => encryptField("Test", "v1")).toThrow(/Invalid encryption key format/);
    });
  });

  describe("Key Rotation Pre-Flight & Batch Migration", () => {
    beforeEach(async () => {
      await seedDatabase();
    });

    it("should abort pre-flight check if source and target versions are identical", () => {
      expect(() => verifyRotationReadiness("v1", "v1")).toThrow(/parameters: source version "v1" and target version "v1" are identical/);
    });

    it("should abort pre-flight check if target key is missing from environment", () => {
      delete process.env.PAYROLL_ENCRYPTION_KEY_V2;
      expect(() => verifyRotationReadiness("v1", "v2")).toThrow(/Target key version "v2" is not configured/);
    });

    it("should abort pre-flight check if source key is missing (protects against premature key deletion)", () => {
      delete process.env.PAYROLL_ENCRYPTION_KEY_V1;
      expect(() => verifyRotationReadiness("v1", "v2")).toThrow(/Source key version "v1" is missing from environment/);
    });

    it("should perform dry-run rotation without modifying database records", async () => {
      const dryResult = await rotateSensitiveEmployeeDetails({
        targetVersion: "v2",
        dryRun: true,
      });

      expect(dryResult.success).toBe(true);
      expect(dryResult.dryRun).toBe(true);
      expect(dryResult.totalRecordsFound).toBeGreaterThan(0);
      expect(dryResult.totalRotated).toBe(dryResult.totalRecordsFound);

      // Verify DB records are still on v1
      const rawRows = await rawClient.execute("SELECT key_version FROM sensitive_employee_details;");
      for (const row of rawRows.rows) {
        expect(row[0]).toBe("v1");
      }
    });

    it("should execute live batch key rotation from v1 to v2 with checkpointing", async () => {
      const checkpoints: any[] = [];
      const liveResult = await rotateSensitiveEmployeeDetails({
        targetVersion: "v2",
        batchSize: 2, // Small batch size to test multiple batch iterations
        dryRun: false,
        onCheckpoint: (info) => checkpoints.push(info),
      });

      expect(liveResult.success).toBe(true);
      expect(liveResult.totalRotated).toBe(liveResult.totalRecordsFound);
      expect(checkpoints.length).toBeGreaterThan(1);

      // Verify all rows in DB are now v2
      const rawRows = await rawClient.execute(
        "SELECT key_version, basic_salary_encrypted, bank_account_number_encrypted FROM sensitive_employee_details;"
      );
      for (const row of rawRows.rows) {
        expect(row[0]).toBe("v2");
        expect(String(row[1]).startsWith("v2:")).toBe(true);
        expect(String(row[2]).startsWith("v2:")).toBe(true);

        // Verify each row decrypts accurately with the new key
        const decryptedSalary = decryptField(String(row[1]));
        expect(parseFloat(decryptedSalary)).toBeGreaterThan(0);
      }
    });
  });
});
