import { rawClient } from "./client";
import { validateEncryptionConfig } from "../security/config-validator";
import { logSecureError } from "../security/safe-logger";

export interface ReadinessReport {
  ready: boolean;
  dbConnected: boolean;
  missingTables: string[];
  indexesReady: boolean;
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
  "roles",
  "user_roles",
  "role_permissions",
  "used_tokens",
  "auth_sessions",
  "audit_logs",
  "user_credentials",
  "otp_challenges",
  "employee_documents",
  "sensitive_employee_details",
  "shifts",
  "shift_assignments",
  "shift_history",
  "attendance_records",
  "attendance_events",
  "attendance_correction_requests",
];

const REQUIRED_INDEXES = [
  { name: "idx_otp_challenges_token", sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_otp_challenges_token ON otp_challenges(challenge_token);" },
  { name: "idx_otp_challenges_user_active", sql: "CREATE INDEX IF NOT EXISTS idx_otp_challenges_user_active ON otp_challenges(user_id, is_used, expires_at);" },
  { name: "idx_sessions_user_active", sql: "CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON auth_sessions(user_id, revoked_at, expires_at);" },
  { name: "idx_employees_user_id", sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);" },
  { name: "idx_user_credentials_user_id", sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);" },
];

/**
 * Checks database connectivity, table completeness, indexes, and encryption readiness.
 */
export async function checkStartupReadiness(): Promise<ReadinessReport> {
  const details: string[] = [];
  const missingTables: string[] = [];
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
  if (dbConnected) {
    try {
      const tablesRes = await rawClient.execute(
        "SELECT name FROM sqlite_master WHERE type='table';"
      );
      const existingTables = new Set(tablesRes.rows.map((r: any) => String(r.name)));

      for (const table of REQUIRED_AUTH_TABLES) {
        if (!existingTables.has(table)) {
          missingTables.push(table);
        }
      }

      if (missingTables.length === 0) {
        details.push(`All ${REQUIRED_AUTH_TABLES.length} required tables verified.`);
      } else {
        details.push(`Missing tables: ${missingTables.join(", ")}`);
      }
    } catch (err: any) {
      logSecureError("StartupReadiness.tableCheck", err);
      details.push("Failed to query sqlite_master for table definitions.");
    }
  }

  // 3. Index Verification
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

  // 4. Encryption Configuration Verification
  const encConfig = validateEncryptionConfig();
  if (encConfig.isValid) {
    details.push(`AES-256-GCM encryption verified (Active: ${encConfig.activeVersion}).`);
  } else {
    details.push(`Encryption configuration warning: ${encConfig.errors.join("; ")}`);
  }

  const isReady = dbConnected && missingTables.length === 0 && encConfig.isValid;

  return {
    ready: isReady,
    dbConnected,
    missingTables,
    indexesReady,
    encryptionReady: encConfig.isValid,
    activeEncryptionVersion: encConfig.activeVersion,
    details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Ensures required authentication tables and indexes exist without destructive changes.
 * Invoked on startup and self-healing checkpoints.
 */
export async function ensureSchemaReady(): Promise<boolean> {
  try {
    // 1. Basic WAL and busy timeout configuration
    try {
      await rawClient.execute("PRAGMA journal_mode = WAL;");
      await rawClient.execute("PRAGMA busy_timeout = 5000;");
    } catch {}

    // 2. Ensure otp_challenges table
    await rawClient.execute(`
      CREATE TABLE IF NOT EXISTS otp_challenges (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        challenge_token TEXT NOT NULL UNIQUE,
        otp_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        is_used INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `);

    // 3. Ensure user_credentials table
    await rawClient.execute(`
      CREATE TABLE IF NOT EXISTS user_credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
        password_hash TEXT NOT NULL,
        password_updated_at INTEGER NOT NULL,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // 4. Ensure auth_sessions table
    await rawClient.execute(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        token_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER,
        ip_address TEXT,
        user_agent TEXT
      );
    `);

    // 5. Ensure indexes
    for (const idx of REQUIRED_INDEXES) {
      await rawClient.execute(idx.sql);
    }

    return true;
  } catch (err: any) {
    logSecureError("StartupReadiness.ensureSchemaReady", err);
    return false;
  }
}

