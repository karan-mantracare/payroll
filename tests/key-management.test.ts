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
import { sensitiveEmployeeDetails } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

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

    it("should rollback the entire batch via database transaction when an injected failure occurs mid-batch", async () => {
      // In a batch of 3 records, inject a failure on sens_EMP-002 (the second record in the batch)
      const failResult = await rotateSensitiveEmployeeDetails({
        targetVersion: "v2",
        batchSize: 3,
        dryRun: false,
        _testInjectedFailureOnRecordId: "sens_EMP-002",
      });

      expect(failResult.success).toBe(false);
      expect(failResult.errors.length).toBeGreaterThan(0);
      expect(failResult.errors[0].error).toContain("TEST_INJECTED_FAILURE");

      // Verify that sens_EMP-001 (which was processed before EMP-002 in the same batch) was NOT committed
      // It must have rolled back to v1!
      const row1Res = await rawClient.execute(
        "SELECT key_version, basic_salary_encrypted FROM sensitive_employee_details WHERE id = 'sens_EMP-001';"
      );
      expect(row1Res.rows[0][0]).toBe("v1");
      expect(String(row1Res.rows[0][1]).startsWith("v1:")).toBe(true);

      // Verify all rows in the table remain v1
      const allRows = await rawClient.execute("SELECT key_version FROM sensitive_employee_details;");
      for (const r of allRows.rows) {
        expect(r[0]).toBe("v1");
      }
    });

    it("should detect concurrent modifications and abort the batch to prevent data overwriting", async () => {
      // Seed fresh state
      await seedDatabase();

      // Execute rotation with concurrent modification simulation hook
      const conflictResult = await rotateSensitiveEmployeeDetails({
        targetVersion: "v2",
        batchSize: 3,
        dryRun: false,
        _testSimulateConcurrentUpdateBeforeWrite: true,
      });

      expect(conflictResult.success).toBe(false);
      expect(conflictResult.errors.length).toBeGreaterThan(0);
      expect(conflictResult.errors[0].error).toContain("CONCURRENT_MODIFICATION_DETECTED");

      // Verify records rolled back and were NOT updated to v2
      const allRows = await rawClient.execute("SELECT key_version FROM sensitive_employee_details;");
      for (const r of allRows.rows) {
        expect(r[0]).toBe("v1");
      }
    });

    it("should make rotation safely resumable after an interruption", async () => {
      await seedDatabase();

      // Rotate only first batch of 2 records using maxBatches: 1
      const firstBatch = await rotateSensitiveEmployeeDetails({
        targetVersion: "v2",
        batchSize: 2,
        maxBatches: 1,
        dryRun: false,
      });

      expect(firstBatch.success).toBe(true);
      expect(firstBatch.totalRotated).toBe(2);

      // Verify exactly 2 records are on v2 and 5 records are still on v1
      const countV2Res = await rawClient.execute("SELECT count(*) FROM sensitive_employee_details WHERE key_version = 'v2';");
      const countV1Res = await rawClient.execute("SELECT count(*) FROM sensitive_employee_details WHERE key_version = 'v1';");
      expect(Number(countV2Res.rows[0][0])).toBe(2);
      expect(Number(countV1Res.rows[0][0])).toBe(5);

      // Resume rotation: it picks up the remaining 5 unmigrated records
      const resumedBatch = await rotateSensitiveEmployeeDetails({
        targetVersion: "v2",
        batchSize: 50,
        dryRun: false,
      });

      expect(resumedBatch.success).toBe(true);
      expect(resumedBatch.totalRotated).toBe(5);

      // Verify now all 7 records are migrated to v2
      const finalV2Res = await rawClient.execute("SELECT count(*) FROM sensitive_employee_details WHERE key_version = 'v2';");
      expect(Number(finalV2Res.rows[0][0])).toBe(7);
    });

    it("should verify all 8 encrypted fields after rotation to v2", async () => {
      await seedDatabase();

      const liveResult = await rotateSensitiveEmployeeDetails({
        targetVersion: "v2",
        batchSize: 50,
        dryRun: false,
      });

      expect(liveResult.success).toBe(true);

      const allRows = await db.select().from(sensitiveEmployeeDetails);
      expect(allRows.length).toBe(7);

      for (const row of allRows) {
        expect(row.keyVersion).toBe("v2");

        // Verify all 8 fields are prefixed with v2:
        expect(row.basicSalaryEncrypted.startsWith("v2:")).toBe(true);
        expect(row.grossSalaryEncrypted.startsWith("v2:")).toBe(true);
        expect(row.netSalaryEncrypted.startsWith("v2:")).toBe(true);
        expect(row.bankAccountNumberEncrypted.startsWith("v2:")).toBe(true);
        expect(row.bankIfscEncrypted.startsWith("v2:")).toBe(true);
        expect(row.taxIdentifierEncrypted.startsWith("v2:")).toBe(true);
        expect(row.identityDocumentNumberEncrypted.startsWith("v2:")).toBe(true);
        expect(row.identityDocumentUrlEncrypted.startsWith("v2:")).toBe(true);

        // Verify all 8 fields decrypt accurately with v2
        const decBasic = decryptField(row.basicSalaryEncrypted);
        const decGross = decryptField(row.grossSalaryEncrypted);
        const decNet = decryptField(row.netSalaryEncrypted);
        const decBankAcc = decryptField(row.bankAccountNumberEncrypted);
        const decIfsc = decryptField(row.bankIfscEncrypted);
        const decTaxId = decryptField(row.taxIdentifierEncrypted);
        const decDocNum = decryptField(row.identityDocumentNumberEncrypted);
        const decDocUrl = decryptField(row.identityDocumentUrlEncrypted);

        expect(parseFloat(decBasic)).toBeGreaterThan(0);
        expect(parseFloat(decGross)).toBeGreaterThan(0);
        expect(parseFloat(decNet)).toBeGreaterThan(0);
        expect(decBankAcc).toMatch(/^98765432100[1-7]$/);
        expect(decIfsc).toBe("HDFC0001234");
        expect(decTaxId).toMatch(/^AAAPL/);
        expect(decDocNum).toBe("IND-ID-99901");
        expect(decDocUrl).toBe("https://secure.mantracare.com/docs/id.pdf");
      }
    });
  });
});
