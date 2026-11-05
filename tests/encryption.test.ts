import { describe, it, expect, beforeAll } from "vitest";
import { encryptField, decryptField, rotateField } from "../src/lib/security/crypto";
import { db, rawClient } from "../src/lib/db/client";
import { getScopedEmployeeById } from "../src/lib/scope/service";
import { SessionContext } from "../src/lib/permissions/types";
import { seedDatabase } from "../src/lib/db/seed";

describe("Application-Level AES-256-GCM Sensitive Data Encryption", () => {
  beforeAll(async () => {
    process.env.PAYROLL_ACTIVE_KEY_VERSION = "v1";
    process.env.PAYROLL_ENCRYPTION_KEY_V1 = "16653300a8f4b5fd31651ab5e712f66368283ea90db280042d10f382ec4af16a";
    process.env.PAYROLL_ENCRYPTION_KEY_V2 = "54abd47926e62762db1c45bac2259cd138430a1214b9d6bc2bc370512e0956e8";
    await seedDatabase();
  });

  it("should encrypt and decrypt sensitive fields accurately using AES-256-GCM", () => {
    const originalSalary = "150000.50";
    const encrypted = encryptField(originalSalary, "v1");

    expect(encrypted).toBeDefined();
    expect(encrypted.startsWith("v1:")).toBe(true);

    const parts = encrypted.split(":");
    expect(parts.length).toBe(4); // version:iv:tag:ciphertext

    const decrypted = decryptField(encrypted);
    expect(decrypted).toBe(originalSalary);
  });

  it("should fail decryption and throw an error if the auth tag or ciphertext is tampered with", () => {
    const plain = "Confidential Bank Account 987654321001";
    const encrypted = encryptField(plain, "v1");

    const parts = encrypted.split(":");
    // Tamper with the ciphertext
    const tamperedCiphertext = parts[3].slice(0, -2) + "ff";
    const tamperedEnvelope = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedCiphertext}`;

    expect(() => decryptField(tamperedEnvelope)).toThrow();
  });

  it("should support key rotation across versions (v1 -> v2)", () => {
    const originalTaxId = "AAAPL9999K";
    const encryptedV1 = encryptField(originalTaxId, "v1");
    expect(encryptedV1.startsWith("v1:")).toBe(true);

    // Rotate field to key version v2
    const rotatedV2 = rotateField(encryptedV1, "v2");
    expect(rotatedV2.startsWith("v2:")).toBe(true);

    // Both should decrypt to the exact same plaintext
    expect(decryptField(encryptedV1)).toBe(originalTaxId);
    expect(decryptField(rotatedV2)).toBe(originalTaxId);
  });

  it("should verify raw Turso rows store encrypted envelopes, not plaintext salaries or account numbers", async () => {
    const rawRows = await rawClient.execute(
      "SELECT basic_salary_encrypted, bank_account_number_encrypted, tax_identifier_encrypted FROM sensitive_employee_details LIMIT 1;"
    );

    expect(rawRows.rows.length).toBeGreaterThan(0);
    const row = rawRows.rows[0];

    const basicSalaryEncrypted = String(row[0]);
    const bankAccountEncrypted = String(row[1]);
    const taxIdEncrypted = String(row[2]);

    // Must be envelope formatted
    expect(basicSalaryEncrypted.startsWith("v1:")).toBe(true);
    expect(bankAccountEncrypted.startsWith("v1:")).toBe(true);
    expect(taxIdEncrypted.startsWith("v1:")).toBe(true);

    // Must NOT contain raw numbers
    expect(basicSalaryEncrypted).not.toContain("350000");
    expect(bankAccountEncrypted).not.toContain("987654321001");
  });

  it("should automatically decrypt in memory and mask according to caller permissions", async () => {
    const adminSession: SessionContext = {
      userId: "usr_admin",
      employeeId: "EMP-002",
      name: "Aakash Admin",
      email: "admin@mantracare.com",
      organizationId: "org_mc_global",
      roles: ["ADMIN"],
      effectivePermissions: ["sensitive.salary.read", "sensitive.bank.read"],
      widestScope: "ORGANIZATION",
      managedDepartmentIds: [],
      managedTeamIds: [],
      directReportIds: [],
      isSuperAdmin: false,
    };

    const empRecord = await getScopedEmployeeById(adminSession, "EMP-001");
    expect(empRecord).not.toBeNull();
    expect(empRecord?.sensitive).toBeDefined();

    // Since adminSession has sensitive.salary.read and sensitive.bank.read, fields are decrypted and unmasked
    expect(empRecord?.sensitive?.basicSalary).toBe(350000);
    expect(empRecord?.sensitive?.bankAccountNumber).toBe("987654321001");

    // But tax identifier is still masked because sensitive.tax.read was NOT granted
    expect(empRecord?.sensitive?.taxIdentifier).toBe("••••••••");
  });
});

