import { and, asc, eq, gt, ne, sql } from "drizzle-orm";
import { db } from "../db/client";
import { sensitiveEmployeeDetails } from "../db/schema";
import { decryptField, encryptField, getKey, rotateField } from "./crypto";

export interface KeyMigrationOptions {
  targetVersion: string;
  sourceVersion?: string;
  batchSize?: number;
  maxBatches?: number;
  dryRun?: boolean;
  onCheckpoint?: (info: { batchIndex: number; processed: number; remaining: number; totalFound: number }) => void;
  // Test hooks:
  _testInjectedFailureOnRecordId?: string;
  _testSimulateConcurrentUpdateBeforeWrite?: boolean;
}

export interface KeyMigrationResult {
  success: boolean;
  dryRun: boolean;
  targetVersion: string;
  totalRecordsFound: number;
  totalRotated: number;
  totalFailed: number;
  batchesCount: number;
  durationMs: number;
  resumable: boolean;
  completed: boolean;
  errors: Array<{ recordId: string; error: string }>;
}

/**
 * Pre-flight verification: Ensures both source and target keys exist and are valid.
 * Protects against losing older keys prematurely or rotating into an unconfigured key.
 */
export function verifyRotationReadiness(sourceVersion: string, targetVersion: string): void {
  const normSource = sourceVersion.toLowerCase().trim();
  const normTarget = targetVersion.toLowerCase().trim();

  if (normSource === normTarget) {
    throw new Error(
      `Invalid rotation parameters: source version "${sourceVersion}" and target version "${targetVersion}" are identical.`
    );
  }

  // 1. Verify target key is loaded and valid in environment
  try {
    getKey(normTarget);
  } catch (err: any) {
    throw new Error(
      `Rotation aborted: Target key version "${normTarget}" is not configured or invalid in environment. ${err.message}`
    );
  }

  // 2. Verify source key is loaded and valid in environment
  // Old encryption keys must remain configured to prevent data loss!
  try {
    getKey(normSource);
  } catch (err: any) {
    throw new Error(
      `Rotation aborted: Source key version "${normSource}" is missing from environment. ` +
      `Older keys must remain configured in environment variables to prevent permanent data loss. ${err.message}`
    );
  }
}

/**
 * Rotates sensitive database records in atomic batches with:
 * 1. libSQL / Turso database transactions (db.transaction) per batch.
 * 2. Guaranteed full-batch rollback on any failure.
 * 3. Optimistic concurrency control (verifies updatedAt and keyVersion during update).
 * 4. Resumability: queries unmigrated records incrementally, resuming where left off.
 * 5. Full 8-field post-rotation verification on every record.
 */
export async function rotateSensitiveEmployeeDetails(
  options: KeyMigrationOptions
): Promise<KeyMigrationResult> {
  const startTime = Date.now();
  const batchSize = Math.max(1, options.batchSize || 50);
  const targetVersion = options.targetVersion.toLowerCase().trim();
  const dryRun = options.dryRun ?? false;
  const errors: Array<{ recordId: string; error: string }> = [];

  // Count total unmigrated records at initiation
  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(sensitiveEmployeeDetails)
    .where(ne(sensitiveEmployeeDetails.keyVersion, targetVersion));

  const totalRecordsFound = Number(countRes[0]?.count || 0);

  if (totalRecordsFound === 0) {
    return {
      success: true,
      completed: true,
      dryRun,
      targetVersion,
      totalRecordsFound: 0,
      totalRotated: 0,
      totalFailed: 0,
      batchesCount: 0,
      durationMs: Date.now() - startTime,
      resumable: true,
      errors: [],
    };
  }

  // Inspect what key versions currently exist in unmigrated records
  const distinctVersionsRes = await db
    .select({ ver: sensitiveEmployeeDetails.keyVersion })
    .from(sensitiveEmployeeDetails)
    .where(ne(sensitiveEmployeeDetails.keyVersion, targetVersion))
    .groupBy(sensitiveEmployeeDetails.keyVersion);

  for (const row of distinctVersionsRes) {
    verifyRotationReadiness(row.ver, targetVersion);
  }

  let totalRotated = 0;
  let batchIndex = 0;
  let lastDryRunProcessedId: string | null = null;

  // Resumable processing loop: always query the next batch of unmigrated records
  while (true) {
    // If errors occurred in previous batch, stop loop (resumable on next run)
    if (errors.length > 0) {
      break;
    }

    // If maxBatches limit reached (e.g. for step-by-step or interrupted migration testing), exit
    if (options.maxBatches && batchIndex >= options.maxBatches) {
      break;
    }

    // Query next batch of unmigrated records, ordered by id
    const conditions = [ne(sensitiveEmployeeDetails.keyVersion, targetVersion)];
    if (dryRun && lastDryRunProcessedId) {
      conditions.push(gt(sensitiveEmployeeDetails.id, lastDryRunProcessedId));
    }

    const batch = await db
      .select()
      .from(sensitiveEmployeeDetails)
      .where(and(...conditions))
      .orderBy(asc(sensitiveEmployeeDetails.id))
      .limit(batchSize);

    if (batch.length === 0) {
      // All unmigrated records processed
      break;
    }

    if (dryRun) {
      lastDryRunProcessedId = batch[batch.length - 1].id;
    }

    batchIndex++;

    // Staging array for prepared records with optimistic concurrency markers
    const stagedUpdates: Array<{
      id: string;
      expectedUpdatedAt: number;
      expectedKeyVersion: string;
      newValues: {
        basicSalaryEncrypted: string;
        grossSalaryEncrypted: string;
        netSalaryEncrypted: string;
        bankAccountNumberEncrypted: string;
        bankIfscEncrypted: string;
        taxIdentifierEncrypted: string;
        identityDocumentNumberEncrypted: string;
        identityDocumentUrlEncrypted: string;
        keyVersion: string;
        version: number;
        updatedAt: number;
      };
    }> = [];

    let batchStagingFailed = false;

    // 1. Process and verify ALL 8 sensitive fields for each record in the batch
    for (const record of batch) {
      try {
        // Rotate all 8 encrypted fields
        const basicSalaryNew = rotateField(record.basicSalaryEncrypted, targetVersion);
        const grossSalaryNew = rotateField(record.grossSalaryEncrypted, targetVersion);
        const netSalaryNew = rotateField(record.netSalaryEncrypted, targetVersion);
        const bankAccountNew = rotateField(record.bankAccountNumberEncrypted, targetVersion);
        const bankIfscNew = rotateField(record.bankIfscEncrypted, targetVersion);
        const taxIdentifierNew = rotateField(record.taxIdentifierEncrypted, targetVersion);
        const identityDocNumNew = rotateField(record.identityDocumentNumberEncrypted, targetVersion);
        const identityDocUrlNew = rotateField(record.identityDocumentUrlEncrypted, targetVersion);

        // 2. Comprehensive 8-field round-trip verification
        const fieldsToVerify = [
          { name: "basicSalary", orig: record.basicSalaryEncrypted, rotated: basicSalaryNew },
          { name: "grossSalary", orig: record.grossSalaryEncrypted, rotated: grossSalaryNew },
          { name: "netSalary", orig: record.netSalaryEncrypted, rotated: netSalaryNew },
          { name: "bankAccountNumber", orig: record.bankAccountNumberEncrypted, rotated: bankAccountNew },
          { name: "bankIfsc", orig: record.bankIfscEncrypted, rotated: bankIfscNew },
          { name: "taxIdentifier", orig: record.taxIdentifierEncrypted, rotated: taxIdentifierNew },
          { name: "identityDocumentNumber", orig: record.identityDocumentNumberEncrypted, rotated: identityDocNumNew },
          { name: "identityDocumentUrl", orig: record.identityDocumentUrlEncrypted, rotated: identityDocUrlNew },
        ];

        for (const f of fieldsToVerify) {
          const origPlain = decryptField(f.orig);
          const rotatedPlain = decryptField(f.rotated);
          if (origPlain !== rotatedPlain) {
            throw new Error(`Round-trip decryption mismatch for field "${f.name}". Verification failed.`);
          }
        }

        stagedUpdates.push({
          id: record.id,
          expectedUpdatedAt: record.updatedAt,
          expectedKeyVersion: record.keyVersion,
          newValues: {
            basicSalaryEncrypted: basicSalaryNew,
            grossSalaryEncrypted: grossSalaryNew,
            netSalaryEncrypted: netSalaryNew,
            bankAccountNumberEncrypted: bankAccountNew,
            bankIfscEncrypted: bankIfscNew,
            taxIdentifierEncrypted: taxIdentifierNew,
            identityDocumentNumberEncrypted: identityDocNumNew,
            identityDocumentUrlEncrypted: identityDocUrlNew,
            keyVersion: targetVersion,
            version: (record.version ?? 1) + 1,
            updatedAt: Math.max(Date.now(), record.updatedAt + 1),
          },
        });
      } catch (err: any) {
        errors.push({
          recordId: record.id,
          error: `Staging verification failed for record ${record.id}: ${err.message}`,
        });
        batchStagingFailed = true;
        break;
      }
    }

    if (batchStagingFailed) {
      break;
    }

    // 2. Execute Batch inside a libSQL / Turso Database Transaction with Rollback
    if (!dryRun) {
      // Simulate concurrent out-of-band write to first item if requested by test hook
      if (options._testSimulateConcurrentUpdateBeforeWrite && stagedUpdates.length > 0) {
        await db
          .update(sensitiveEmployeeDetails)
          .set({ updatedAt: Date.now() + 88888 })
          .where(eq(sensitiveEmployeeDetails.id, stagedUpdates[0].id));
      }

      try {
        await db.transaction(async (tx) => {
          for (const item of stagedUpdates) {
            // Test hook: inject an intentional failure to verify full-batch rollback
            if (options._testInjectedFailureOnRecordId === item.id) {
              throw new Error(
                `TEST_INJECTED_FAILURE: Simulated mid-batch failure on record ${item.id} to test transaction rollback.`
              );
            }

            // Optimistic Concurrency Control:
            // Ensure no concurrent update touched updatedAt or keyVersion since our read
            const updateResult: any = await tx
              .update(sensitiveEmployeeDetails)
              .set(item.newValues)
              .where(
                and(
                  eq(sensitiveEmployeeDetails.id, item.id),
                  eq(sensitiveEmployeeDetails.updatedAt, item.expectedUpdatedAt),
                  eq(sensitiveEmployeeDetails.keyVersion, item.expectedKeyVersion)
                )
              );

            if (updateResult.rowsAffected === 0) {
              throw new Error(
                `CONCURRENT_MODIFICATION_DETECTED: Record ${item.id} was updated concurrently by another transaction. ` +
                `Aborting batch to preserve employee data integrity.`
              );
            }
          }
        });
      } catch (txErr: any) {
        errors.push({
          recordId: `batch_${batchIndex}`,
          error: `Batch transaction aborted and rolled back: ${txErr.message}`,
        });
        // Full batch rolled back by db.transaction, break to exit
        break;
      }
    }

    totalRotated += stagedUpdates.length;

    // Notify checkpoint
    if (options.onCheckpoint) {
      options.onCheckpoint({
        batchIndex,
        processed: totalRotated,
        remaining: Math.max(0, totalRecordsFound - totalRotated),
        totalFound: totalRecordsFound,
      });
    }
  }

  const success = errors.length === 0;
  const completed = success && totalRotated >= totalRecordsFound;

  return {
    success,
    dryRun,
    targetVersion,
    totalRecordsFound,
    totalRotated,
    totalFailed: errors.length,
    batchesCount: batchIndex,
    durationMs: Date.now() - startTime,
    resumable: true,
    completed,
    errors,
  };
}
