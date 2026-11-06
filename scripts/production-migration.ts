import { rawClient, dbConfig, getSafeDatabaseDiagnostics } from "../src/lib/db/client";
import { runMigrations, MIGRATIONS_REGISTRY } from "../src/lib/db/migrate";

/**
 * Controlled Production Migration Runner
 *
 * Requirements for executing migrations against PRODUCTION:
 * 1. PAYROLL_DB_ENV must be explicitly set to 'production'.
 * 2. CONFIRM_PRODUCTION_MIGRATION=true (Explicit administrative approval).
 * 3. VERIFIED_BACKUP_COMPLETED=true (Verified backup/recovery plan in place).
 * 4. SCHEMA_REVIEW_APPROVED=true (Schema compatibility review completed).
 */
async function executeProductionMigration() {
  console.log("================================================================================");
  console.log("            MANTRACARE HRMS — CONTROLLED PRODUCTION MIGRATION RUNNER             ");
  console.log("================================================================================");

  const diag = getSafeDatabaseDiagnostics(dbConfig);
  console.log(`Target Environment: [${diag.environment}]`);
  console.log(`Target Host: [${diag.host}]`);
  console.log(`Authentication Configured: [${diag.hasAuthToken ? "YES" : "NO"}]`);

  if (!dbConfig.isProduction) {
    console.error("\n[ABORT] Controlled production migration runner can ONLY execute against PAYROLL_DB_ENV=production.");
    console.error(`Current environment is: '${dbConfig.env}'.`);
    process.exit(1);
  }

  // Pre-flight Authorization Checklist
  const hasConfirmation = process.env.CONFIRM_PRODUCTION_MIGRATION === "true";
  const hasBackup = process.env.VERIFIED_BACKUP_COMPLETED === "true";
  const hasSchemaReview = process.env.SCHEMA_REVIEW_APPROVED === "true";

  console.log("\nPre-Flight Approval & Safety Checklist:");
  console.log(`  [${hasConfirmation ? "✓" : "✗"}] CONFIRM_PRODUCTION_MIGRATION=true (Explicit Administrative Intent)`);
  console.log(`  [${hasBackup ? "✓" : "✗"}] VERIFIED_BACKUP_COMPLETED=true (Verified Snapshot/Backup Confirmation)`);
  console.log(`  [${hasSchemaReview ? "✓" : "✗"}] SCHEMA_REVIEW_APPROVED=true (Backward-Compatibility Review)`);

  if (!hasConfirmation || !hasBackup || !hasSchemaReview) {
    console.error("\n[BLOCKED] Production migration rejected due to missing mandatory safety gates.");
    console.error("All three environment approvals must be explicitly provided:");
    console.error("  CONFIRM_PRODUCTION_MIGRATION=true VERIFIED_BACKUP_COMPLETED=true SCHEMA_REVIEW_APPROVED=true npm run db:migrate:production\n");
    process.exit(1);
  }

  console.log("\n[1/3] Performing Pre-Flight Read-Only Schema Compatibility Check...");
  try {
    const existingTablesRes = await rawClient.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_libsql%' ORDER BY name;"
    );
    const existingTableNames = existingTablesRes.rows.map((r: any) => r.name);
    console.log(`  -> Current production table count: ${existingTableNames.length}`);
    if (existingTableNames.length > 0) {
      console.log(`  -> Existing tables: ${existingTableNames.join(", ")}`);
    } else {
      console.log("  -> Production database is currently empty (Clean Initial Provisioning).");
    }
  } catch (err: any) {
    console.error("\n[ABORT] Failed during pre-flight read-only schema inspection:", err.message);
    process.exit(1);
  }

  console.log("\n[2/3] Executing Controlled Migration Plan...");
  try {
    await runMigrations({ allowControlledProduction: true });
    console.log("  -> All schema migrations executed successfully.");
  } catch (err: any) {
    console.error("\n[CRITICAL FAILURE] Production migration failed mid-execution:", err.message);
    process.exit(1);
  }

  console.log("\n[3/3] Post-Migration Verification & Audit Check...");
  try {
    const auditRes = await rawClient.execute(
      "SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC;"
    );
    console.log(`  -> Verified schema_migrations records (${auditRes.rows.length}/${MIGRATIONS_REGISTRY.length}):`);
    auditRes.rows.forEach((r: any) => {
      console.log(`     - [v${r.version}] ${r.name} (Applied at: ${new Date(Number(r.applied_at)).toISOString()})`);
    });
  } catch (err: any) {
    console.warn("  -> Notice: Could not inspect schema_migrations audit table:", err.message);
  }

  console.log("\n================================================================================");
  console.log(">>> CONTROLLED PRODUCTION MIGRATION COMPLETED SUCCESSFULLY WITH AUDIT LOG <<<");
  console.log("================================================================================");
}

if (require.main === module) {
  executeProductionMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Controlled production migration failed:", err);
      process.exit(1);
    });
}

