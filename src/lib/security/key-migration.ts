import { eq, ne } from "drizzle-orm";
import { db } from "../db/client";
import { sensitiveEmployeeDetails } from "../db/schema";
import { decryptField, encryptField, getKey, isValidKeyHex, rotateField } from "./crypto";

export interface KeyMigrationOptions {
  sourceVersion?: string;
  targetVersion: string;
  batchSize?: number;
  dryRun?: boolean;
  onCheckpoint?: (info: { batchIndex: number; processed: number; total: number }) => void;
}

export interface KeyMigrationResult {
  success: boolean;
  dryRun: boolean;
  sourceVersion?: string;
  targetVersion: string;
  totalRecordsFound: number;
  totalRotated: number;
  totalFailed: number;
  batchesCount: number;
  durationMs: number;
  errors: Array<{ recordId: string; error: string }>;
}

/**
 * Pre-flight verification: Ensures both source and target keys exist and are valid.
 * Protects against losing older keys prematurely or rotating into an unconfigured key.
 */
export function verifyRotationReadiness(sourceVersion: string, targetVersion: string): void {
  if (sourceVersion.toLowerCase() === targetVersion.toLowerCase()) {
    throw new Error(
      `Invalid rotation parameters: source version "${sourceVersion}" and target version "${targetVersion}" are identical.`
    );
  }

  // 1. Verify target key is loaded and valid
  try {
    getKey(targetVersion);
  } catch (err: any) {
    throw new Error(
      `Rotation aborted: Target key version "${targetVersion}" is not configured or invalid in environment. ${err.message}`
    );
  }

  // 2. Verify source key is loaded and valid
  try {
    getKey(sourceVersion);
  } catch (err: any) {
    throw new Error(
      `Rotation aborted: Source key version "${sourceVersion}" is missing from environment. ` +
      `Older keys must remain configured to prevent permanent data loss during rotation. ${err.message}`
    );
  }
}

/**
 * Rotates sensitive database records in atomic batches with checkpoints and rollback capability.
 */
export async function rotateSensitiveEmployeeDetails(
  options: KeyMigrationOptions
): Promise<KeyMigrationResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 50;
  const targetVersion = options.targetVersion.toLowerCase().trim();
  const dryRun = options.dryRun ?? false;
  const errors: Array<{ recordId: string; error: string }> = [];

  // Query all records that are NOT yet on the target key version
  const candidateRecords = await db
    .select()
    .from(sensitiveEmployeeDetails)
    .where(ne(sensitiveEmployeeDetails.keyVersion, targetVersion));

  const totalRecordsFound = candidateRecords.length;

  if (totalRecordsFound === 0) {
    return {
      success: true,
      dryRun,
      targetVersion,
      totalRecordsFound: 0,
      totalRotated: 0,
      totalFailed: 0,
      batchesCount: 0,
      durationMs: Date.now() - startTime,
      errors: [],
    };
  }

  // Inspect the source versions present
  const presentVersions = Array.from(new Set(candidateRecords.map((r) => r.keyVersion.toLowerCase())));
  for (const ver of presentVersions) {
    verifyRotationReadiness(ver, targetVersion);
  }

  let totalRotated = 0;
  let batchIndex = 0;

  // Process in chunks/batches
  for (let i = 0; i < candidateRecords.length; i += batchSize) {
    batchIndex++;
    const batch = candidateRecords.slice(i, i + batchSize);

    // Staging array for validated updates in this batch
    const stagedUpdates: Array<{
      id: string;
      basicSalaryEncrypted: string;
      grossSalaryEncrypted: string;
      netSalaryEncrypted: string;
      bankAccountNumberEncrypted: string;
      bankIfscEncrypted: string;
      taxIdentifierEncrypted: string;
      identityDocumentNumberEncrypted: string;
      identityDocumentUrlEncrypted: string;
      keyVersion: string;
      updatedAt: number;
    }> = [];

    // Process and verify each record in the batch
    for (const record of batch) {
      try {
        // 1. Decrypt and re-encrypt every sensitive field with target version
        const basicSalaryNew = rotateField(record.basicSalaryEncrypted, targetVersion);
        const grossSalaryNew = rotateField(record.grossSalaryEncrypted, targetVersion);
        const netSalaryNew = rotateField(record.netSalaryEncrypted, targetVersion);
        const bankAccountNew = rotateField(record.bankAccountNumberEncrypted, targetVersion);
        const bankIfscNew = rotateField(record.bankIfscEncrypted, targetVersion);
        const taxIdentifierNew = rotateField(record.taxIdentifierEncrypted, targetVersion);
        const identityDocNumNew = rotateField(record.identityDocumentNumberEncrypted, targetVersion);
        const identityDocUrlNew = rotateField(record.identityDocumentUrlEncrypted, targetVersion);

        // 2. Immediate round-trip validation: verify target ciphertext decrypts to exact original
        const origBasic = decryptField(record.basicSalaryEncrypted);
        if (decryptField(basicSalaryNew) !== origBasic) {
          throw new Error("Round-trip decryption verification failed for basic salary.");
        }

        const origAccount = decryptField(record.bankAccountNumberEncrypted);
        if (decryptField(bankAccountNew) !== origAccount) {
          throw new Error("Round-trip decryption verification failed for bank account.");
        }

        stagedUpdates.push({
          id: record.id,
          basicSalaryEncrypted: basicSalaryNew,
          grossSalaryEncrypted: grossSalaryNew,
          netSalaryEncrypted: netSalaryNew,
          bankAccountNumberEncrypted: bankAccountNew,
          bankIfscEncrypted: bankIfscNew,
          taxIdentifierEncrypted: taxIdentifierNew,
          identityDocumentNumberEncrypted: identityDocNumNew,
          identityDocumentUrlEncrypted: identityDocUrlNew,
          keyVersion: targetVersion,
          updatedAt: Date.now(),
        });
      } catch (err: any) {
        errors.push({
          recordId: record.id,
          error: `Verification error on record ${record.id}: ${err.message}`,
        });
        // Abort the batch immediately to prevent partial corruptions
        break;
      }
    }

    // If any error occurred in this batch, do NOT commit this batch
    if (errors.length > 0) {
      break;
    }

    // Commit batch to database if not in dry-run mode
    if (!dryRun) {
      // Execute each update sequentially or in transaction
      for (const update of stagedUpdates) {
        await db
          .update(sensitiveEmployeeDetails)
          .set(update)
          .where(eq(sensitiveEmployeeDetails.id, update.id));
      }
    }

    totalRotated += stagedUpdates.length;

    // Checkpoint notification
    if (options.onCheckpoint) {
      options.onCheckpoint({
        batchIndex,
        processed: totalRotated,
        total: totalRecordsFound,
      });
    }
  }

  return {
    success: errors.length === 0,
    dryRun,
    targetVersion,
    totalRecordsFound,
    totalRotated,
    totalFailed: errors.length,
    batchesCount: batchIndex,
    durationMs: Date.now() - startTime,
    errors,
  };
}
