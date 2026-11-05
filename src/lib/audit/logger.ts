import { createHash } from "crypto";
import { db } from "../db/client";
import { auditLogs } from "../db/schema";
import { desc, sql } from "drizzle-orm";

const AUDIT_SALT = process.env.AUDIT_LOG_SALT || "mc_audit_salt_2026_default";
const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export interface AuditRecordInput {
  actorUserId: string;
  actorEmployeeId?: string;
  action: string;
  targetEntity: string;
  targetId: string;
  changes: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditRecord {
  id: string;
  timestamp: number;
  actorUserId: string;
  actorEmployeeId: string | null;
  action: string;
  targetEntity: string;
  targetId: string;
  changesJson: string;
  ipAddress: string | null;
  userAgent: string | null;
  prevHash: string;
  currentHash: string;
}

export function computeAuditHash(
  prevHash: string,
  timestamp: number,
  actorUserId: string,
  action: string,
  targetEntity: string,
  targetId: string,
  changesJson: string,
  salt: string = AUDIT_SALT
): string {
  const content = `${prevHash}|${timestamp}|${actorUserId}|${action}|${targetEntity}|${targetId}|${changesJson}|${salt}`;
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Appends a tamper-evident audit record to the database with cryptographic hash chaining.
 */
export async function logAuditEvent(input: AuditRecordInput): Promise<AuditRecord> {
  // 1. Fetch latest record to get its hash
  const latestRecords = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.timestamp), desc(auditLogs.id))
    .limit(1);

  const prevHash = latestRecords.length > 0 ? latestRecords[0].currentHash : GENESIS_HASH;
  const timestamp = Date.now();
  const id = `audit_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;
  const changesJson = JSON.stringify(input.changes);

  // 2. Compute cryptographic hash chain entry
  const currentHash = computeAuditHash(
    prevHash,
    timestamp,
    input.actorUserId,
    input.action,
    input.targetEntity,
    input.targetId,
    changesJson
  );

  const newRecord: typeof auditLogs.$inferInsert = {
    id,
    timestamp,
    actorUserId: input.actorUserId,
    actorEmployeeId: input.actorEmployeeId || null,
    action: input.action,
    targetEntity: input.targetEntity,
    targetId: input.targetId,
    changesJson,
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent || null,
    prevHash,
    currentHash,
  };

  await db.insert(auditLogs).values(newRecord);

  return {
    ...newRecord,
    actorEmployeeId: newRecord.actorEmployeeId || null,
    ipAddress: newRecord.ipAddress || null,
    userAgent: newRecord.userAgent || null,
  };
}

/**
 * Verifies the integrity of the audit log chain.
 * Returns true if the entire chain is intact, or false if any tampering, omission, or alteration occurred.
 * @param records Chronologically ordered list of audit records
 * @param startPrevHash Optional expected previous hash for the first record (defaults to records[0].prevHash if verifying a sub-chain)
 */
export function verifyAuditLogChain(
  records: AuditRecord[],
  startPrevHash?: string
): {
  valid: boolean;
  error?: string;
  tamperedIndex?: number;
  tamperedId?: string;
} {
  if (records.length === 0) return { valid: true };

  // Records must be in chronological order
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const expectedPrevHash =
      i === 0
        ? startPrevHash !== undefined
          ? startPrevHash
          : record.prevHash
        : records[i - 1].currentHash;

    if (record.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        error: `Broken hash chain link: record prevHash does not match previous record currentHash`,
        tamperedIndex: i,
        tamperedId: record.id,
      };
    }

    const recalculatedHash = computeAuditHash(
      record.prevHash,
      record.timestamp,
      record.actorUserId,
      record.action,
      record.targetEntity,
      record.targetId,
      record.changesJson
    );

    if (record.currentHash !== recalculatedHash) {
      return {
        valid: false,
        error: `Tampered payload detected: record hash does not match recomputed SHA-256`,
        tamperedIndex: i,
        tamperedId: record.id,
      };
    }
  }

  return { valid: true };
}
