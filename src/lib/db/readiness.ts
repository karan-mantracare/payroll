import { rawClient } from "./client";
import { validateEncryptionConfig } from "../security/config-validator";
import { logSecureError } from "../security/safe-logger";
import { MIGRATIONS_REGISTRY } from "./migrate";

export interface ReadinessReport {
  ready: boolean;
  dbConnected: boolean;
  missingTables: string[];
  missingMigrations: string[];
  missingColumns: string[];
  indexesReady: boolean;
  schemaValid: boolean;
  migrationHistoryVerified: boolean;
  encryptionReady: boolean;
  activeEncryptionVersion: string;
  details: string[];
  timestamp: string;
}

export const REQUIRED_AUTH_TABLES = [
  "organizations",
  "departments",
  "locations",
  "teams",
  "users",
  "employees",
  "employee_id_configs",
  "employee_status_history",
  "employee_manager_history",
  "employee_documents",
  "sensitive_employee_details",
  "attendance_policies",
  "shifts",
  "shift_assignments",
  "shift_history",
  "attendance_records",
  "attendance_events",
  "attendance_correction_requests",
  "roles",
  "user_roles",
  "role_permissions",
  "used_tokens",
  "auth_sessions",
  "audit_logs",
  "user_credentials",
  "otp_challenges",
  "password_reset_tokens",
  "schema_migrations",
];
export const ALL_SYSTEM_TABLES = REQUIRED_AUTH_TABLES;

const CORE_COLUMN_REQUIREMENTS: Record<string, string[]> = {
  employees: ["id", "employee_code", "user_id", "manager_id", "reporting_hierarchy", "status", "concurrency_version"],
  sensitive_employee_details: ["employee_id", "basic_salary_encrypted", "gross_salary_encrypted", "net_salary_encrypted", "bank_account_number_encrypted", "key_version"],
  otp_challenges: ["id", "user_id", "challenge_token", "otp_hash", "expires_at", "attempts", "is_used"],
  password_reset_tokens: ["id", "user_id", "token_hash", "expires_at", "is_used"],
  user_credentials: ["user_id", "password_hash", "failed_login_attempts", "locked_until"],
  auth_sessions: ["session_id", "user_id", "token_hash", "expires_at", "revoked_at"],
};

const REQUIRED_INDEXES = [
  { name: "idx_otp_challenges_token", sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_otp_challenges_token ON otp_challenges(challenge_token);" },
  { name: "idx_otp_challenges_user_active", sql: "CREATE INDEX IF NOT EXISTS idx_otp_challenges_user_active ON otp_challenges(user_id, is_used, expires_at);" },
  { name: "idx_sessions_user_active", sql: "CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON auth_sessions(user_id, revoked_at, expires_at);" },
  { name: "idx_employees_user_id", sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);" },
  { name: "idx_user_credentials_user_id", sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);" },
  { name: "idx_password_reset_token", sql: "CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token_hash);" },
];

/**
 * Checks database connectivity, complete table existence, column specifications,
 * versioned migration history, and encryption readiness.
 */
export async function checkStartupReadiness(): Promise<ReadinessReport> {
  const details: string[] = [];
  const missingTables: string[] = [];
  const missingMigrations: string[] = [];
  const missingColumns: string[] = [];
  let dbConnected = false;
  let indexesReady = true;

  // 1. Database Ping
  try {
    const pingRes = await rawClient.execute("SELECT 1 AS alive;");
    dbConnected = pingRes.rows.length > 0;
    details.push("Database ping: SUCCESS");
  } catch (err: any) {
    dbConnected = false;
    logSecureError("StartupReadiness.dbPing", err);
    details.push(`Database ping failed: ${err?.message || "Connection refused"}`);
  }

  // 2. Table Inspection
  let existingTables = new Set<string>();
  if (dbConnected) {
    try {
      const tablesRes = await rawClient.execute(
        "SELECT name FROM sqlite_master WHERE type='table';"
      );
      existingTables = new Set(tablesRes.rows.map((r: any) => String(r.name)));

      for (const table of REQUIRED_AUTH_TABLES) {
        if (!existingTables.has(table)) {
          missingTables.push(table);
        }
      }

      if (missingTables.length === 0) {
        details.push(`All ${REQUIRED_AUTH_TABLES.length} system tables verified.`);
      } else {
        details.push(`Missing tables (${missingTables.length}): ${missingTables.join(", ")}`);
      }
    } catch (err: any) {
      logSecureError("StartupReadiness.tableCheck", err);
      details.push("Failed to query sqlite_master for table definitions.");
    }
  }

  // 3. Complete Migration History Audit (Validates schema_migrations)
  let migrationHistoryVerified = false;
  if (dbConnected && existingTables.has("schema_migrations")) {
    try {
      const migRes = await rawClient.execute("SELECT version FROM schema_migrations;");
      const appliedVersions = new Set(migRes.rows.map((r: any) => String(r.version)));

      for (const step of MIGRATIONS_REGISTRY) {
        if (!appliedVersions.has(step.version)) {
          missingMigrations.push(`v${step.version} (${step.name})`);
        }
      }

      if (missingMigrations.length === 0) {
        migrationHistoryVerified = true;
        details.push(`All ${MIGRATIONS_REGISTRY.length} migration versions verified in schema_migrations.`);
      } else {
        details.push(`Missing migration versions: ${missingMigrations.join(", ")}`);
      }
    } catch (err: any) {
      logSecureError("StartupReadiness.migrationAudit", err);
      details.push("Failed to query schema_migrations audit log.");
    }
  } else if (dbConnected) {
    missingMigrations.push("schema_migrations table not found");
  }

  // 4. Core Column Schema Completeness Validation
  if (dbConnected) {
    try {
      for (const [tableName, expectedCols] of Object.entries(CORE_COLUMN_REQUIREMENTS)) {
        if (!existingTables.has(tableName)) continue;
        const colRes = await rawClient.execute(`PRAGMA table_info(${tableName});`);
        const presentCols = new Set(colRes.rows.map((r: any) => String(r.name).toLowerCase()));

        for (const col of expectedCols) {
          if (!presentCols.has(col.toLowerCase())) {
            missingColumns.push(`${tableName}.${col}`);
          }
        }
      }

      if (missingColumns.length === 0) {
        details.push("Core table column definitions verified complete.");
      } else {
        details.push(`Missing columns: ${missingColumns.join(", ")}`);
      }
    } catch (err: any) {
      logSecureError("StartupReadiness.columnCheck", err);
      details.push("Column completeness check warning.");
    }
  }

  // 5. Index Verification
  if (dbConnected && missingTables.length === 0) {
    try {
      for (const idx of REQUIRED_INDEXES) {
        await rawClient.execute(idx.sql);
      }
      details.push("Performance and uniqueness indexes verified.");
    } catch (err: any) {
      indexesReady = false;
      logSecureError("StartupReadiness.indexCheck", err);
      details.push("Index verification warning: Some indexes could not be checked/created.");
    }
  } else {
    indexesReady = false;
  }

  // 6. Application-Level Encryption Readiness
  const encValidation = validateEncryptionConfig();
  if (encValidation.isValid) {
    details.push(`Encryption keys verified: Active version [${encValidation.activeVersion}] ready.`);
  } else {
    details.push(`Encryption error: ${encValidation.errors.join("; ")}`);
  }

  const schemaValid = missingTables.length === 0 && missingColumns.length === 0;
  const ready =
    dbConnected &&
    schemaValid &&
    migrationHistoryVerified &&
    indexesReady &&
    encValidation.isValid;

  return {
    ready,
    dbConnected,
    missingTables,
    missingMigrations,
    missingColumns,
    indexesReady,
    schemaValid,
    migrationHistoryVerified,
    encryptionReady: encValidation.isValid,
    activeEncryptionVersion: encValidation.activeVersion || "v1",
    details,
    timestamp: new Date().toISOString(),
  };
}
