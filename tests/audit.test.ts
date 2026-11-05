import { describe, it, expect, beforeAll } from "vitest";
import { logAuditEvent, verifyAuditLogChain, AuditRecord } from "../src/lib/audit/logger";
import { seedDatabase } from "../src/lib/db/seed";

describe("Tamper-Evident SHA-256 Audit Log Engine", () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  it("should append tamper-evident records and verify valid chain integrity", async () => {
    const rec1 = await logAuditEvent({
      actorUserId: "usr_admin",
      actorEmployeeId: "EMP-002",
      action: "EMPLOYEE_ROLE_ASSIGNED",
      targetEntity: "users",
      targetId: "usr_employee",
      changes: { newRole: "TEAM_MANAGER" },
      ipAddress: "192.168.1.10",
    });

    const rec2 = await logAuditEvent({
      actorUserId: "usr_admin",
      actorEmployeeId: "EMP-002",
      action: "SALARY_STRUCTURE_MODIFIED",
      targetEntity: "sensitive_details",
      targetId: "sens_EMP-006",
      changes: { newBasic: 135000, oldBasic: 120000 },
      ipAddress: "192.168.1.10",
    });

    expect(rec1.currentHash).toBeDefined();
    expect(rec2.prevHash).toBe(rec1.currentHash);

    const verification = verifyAuditLogChain([rec1, rec2]);
    expect(verification.valid).toBe(true);
    expect(verification.error).toBeUndefined();
  });

  it("should immediately detect tampered audit payload", async () => {
    const rec1 = await logAuditEvent({
      actorUserId: "usr_admin",
      action: "INITIAL_CHECK",
      targetEntity: "system",
      targetId: "check_1",
      changes: { status: "OK" },
    });

    const rec2 = await logAuditEvent({
      actorUserId: "usr_admin",
      action: "CONFIDENTIAL_PAYROLL_RUN",
      targetEntity: "payroll",
      targetId: "batch_101",
      changes: { approvedAmount: 5000000 },
    });

    // Malicious attacker attempts to silently modify approvedAmount in database without updating hash
    const tamperedRec2: AuditRecord = {
      ...rec2,
      changesJson: JSON.stringify({ approvedAmount: 9000000 }), // Tampered!
    };

    const verification = verifyAuditLogChain([rec1, tamperedRec2]);
    expect(verification.valid).toBe(false);
    expect(verification.error).toContain("Tampered payload detected");
    expect(verification.tamperedId).toBe(rec2.id);
  });

  it("should immediately detect dropped or broken hash chain link", async () => {
    const rec1 = await logAuditEvent({
      actorUserId: "usr_admin",
      action: "ACTION_A",
      targetEntity: "system",
      targetId: "a",
      changes: {},
    });

    const rec2 = await logAuditEvent({
      actorUserId: "usr_admin",
      action: "ACTION_B",
      targetEntity: "system",
      targetId: "b",
      changes: {},
    });

    // An attacker drops rec1 or alters the prevHash pointer
    const invalidPrevHashRec2: AuditRecord = {
      ...rec2,
      prevHash: "tampered_fake_previous_hash_value_12345",
    };

    const verification = verifyAuditLogChain([rec1, invalidPrevHashRec2]);
    expect(verification.valid).toBe(false);
    expect(verification.error).toContain("Broken hash chain link");
  });

  it("should maintain 100% cryptographic hash chain consistency during high concurrent audit writes", async () => {
    // 10 simultaneous concurrent audit events fired at the exact same millisecond
    const concurrentWrites = Array.from({ length: 10 }, (_, i) =>
      logAuditEvent({
        actorUserId: `usr_concurrent_${i}`,
        actorEmployeeId: `EMP-00${(i % 5) + 1}`,
        action: `CONCURRENT_OPERATION_${i}`,
        targetEntity: "payroll_batch",
        targetId: `item_${i}`,
        changes: { index: i, timestamp: Date.now() },
      })
    );

    const loggedRecords = await Promise.all(concurrentWrites);
    expect(loggedRecords.length).toBe(10);

    // Verify that every single consecutive pair forms a continuous cryptographic chain
    for (let i = 1; i < loggedRecords.length; i++) {
      expect(loggedRecords[i].prevHash).toBe(loggedRecords[i - 1].currentHash);
    }

    // Verify the entire batch with the audit integrity verifier
    const batchVerification = verifyAuditLogChain(loggedRecords);
    expect(batchVerification.valid).toBe(true);
    expect(batchVerification.error).toBeUndefined();
  });
});

