import { rotateSensitiveEmployeeDetails, verifyRotationReadiness } from "../src/lib/security/key-migration";
import { validateEncryptionConfig } from "../src/lib/security/crypto";

async function main() {
  const args = process.argv.slice(2);
  const targetArg = args.find((a) => a.startsWith("--target="))?.split("=")[1] || "v2";
  const dryRun = args.includes("--dry-run");
  const batchSizeArg = args.find((a) => a.startsWith("--batch-size="))?.split("=")[1];
  const batchSize = batchSizeArg ? parseInt(batchSizeArg, 10) : 50;

  console.log("=== MantraCare Payroll: Sensitive Data Key Rotation ===");
  console.log(`Target Key Version : ${targetArg}`);
  console.log(`Dry Run Mode       : ${dryRun ? "ENABLED (No changes will be written)" : "DISABLED (LIVE MUTATION)"}`);
  console.log(`Batch Size         : ${batchSize}`);

  // 1. Validate environment configuration
  const config = validateEncryptionConfig();
  console.log(`Configured Versions: [${config.configuredVersions.join(", ")}]`);

  if (!config.isValid) {
    console.error("Configuration errors detected:");
    config.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  // 2. Run rotation
  try {
    const result = await rotateSensitiveEmployeeDetails({
      targetVersion: targetArg,
      batchSize,
      dryRun,
      onCheckpoint: (info) => {
        console.log(`[Checkpoint] Batch ${info.batchIndex} processed: ${info.processed}/${info.total} records.`);
      },
    });

    console.log("\n=== Key Rotation Summary ===");
    console.log(`Success              : ${result.success}`);
    console.log(`Total Records Found  : ${result.totalRecordsFound}`);
    console.log(`Total Records Rotated: ${result.totalRotated}`);
    console.log(`Total Failed         : ${result.totalFailed}`);
    console.log(`Batches Processed    : ${result.batchesCount}`);
    console.log(`Duration             : ${result.durationMs}ms`);

    if (!result.success) {
      console.error("\nErrors encountered:");
      result.errors.forEach((e) => console.error(`  - [Record ${e.recordId}]: ${e.error}`));
      process.exit(1);
    }

    console.log("\nRotation completed successfully.");
    process.exit(0);
  } catch (err: any) {
    console.error(`\nFatal error during key rotation: ${err.message}`);
    process.exit(1);
  }
}

main();
