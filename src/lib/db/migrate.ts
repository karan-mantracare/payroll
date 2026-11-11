import { rawClient, dbConfig, getSafeDatabaseDiagnostics } from "./client";

export interface MigrationStep {
  version: string;
  name: string;
  description: string;
}

export const MIGRATIONS_REGISTRY: MigrationStep[] = [
  { version: "001", name: "core_org_and_identity", description: "Organizations, Departments, Locations, Teams, Users, Roles" },
  { version: "002", name: "employee_master_and_history", description: "Employees, Configs, Status & Manager Histories" },
  { version: "003", name: "documents_and_sensitive_details", description: "Employee Documents, Sensitive Details & Encryption Envelope" },
  { version: "004", name: "attendance_and_shifts", description: "Attendance Policies, Shifts, Assignments, Records & Corrections" },
  { version: "005", name: "auth_credentials_otp_reset_and_audit", description: "Credentials, OTP Challenges, Reset Tokens, Sessions & Audit Logs" },
  { version: "006", name: "performance_and_security_indexes", description: "Core Unique & Query Performance Indexes" },
];

/**
 * Safely executes an ALTER TABLE ADD COLUMN statement.
 * Explicitly ignores expected benign duplicate-column / already-exists errors,
 * but surfaces all unexpected failures immediately.
 */
export async function executeSafeAlterColumn(sql: string, description: string): Promise<void> {
  try {
    await rawClient.execute(sql);
  } catch (err: any) {
    const msg = (err?.message || "").toLowerCase();
    // Explicitly check for benign idempotency conditions
    if (msg.includes("duplicate column") || msg.includes("already exists")) {
      return;
    }
    // Surface unexpected failures
    console.error(`[Migration Error] Failed executing ${description}: ${sql}`, err);
    throw new Error(`[Migration Failure] ${description} failed: ${err.message}`);
  }
}

export interface RunMigrationsOptions {
  allowControlledProduction?: boolean;
}

export async function runMigrations(options?: RunMigrationsOptions) {
  const diag = getSafeDatabaseDiagnostics(dbConfig);

  // Safety Guard: Block standard runner from touching production
  if (dbConfig.isProduction && !options?.allowControlledProduction) {
    throw new Error(
      "[CRITICAL SAFETY GUARD] Direct migration against PRODUCTION is blocked in standard runner. Use controlled production migration runner: 'npm run db:migrate:production' with required approval and backup verification flags."
    );
  }

  console.log(`Running Turso schema migrations for environment: [${diag.environment}] (host: ${diag.host})...`);

  // Safe PRAGMA initialization for local SQLite (ignored gracefully on remote HTTP libSQL)
  try {
    await rawClient.execute("PRAGMA journal_mode = WAL;");
    await rawClient.execute("PRAGMA busy_timeout = 5000;");
  } catch (pragmaErr: any) {
    const msg = (pragmaErr?.message || "").toLowerCase();
    if (!msg.includes("pragma") && !msg.includes("unsupported") && !msg.includes("interactive")) {
      console.warn(`[Migration Notice] PRAGMA initialization warning: ${pragmaErr.message}`);
    }
  }

  // Ensure migration tracking table exists
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL,
      checksum TEXT NOT NULL
    );
  `);

  // --------------------------------------------------------------------------
  // Version 001: Core Organization & Identity
  // --------------------------------------------------------------------------
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'India',
      created_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL REFERENCES departments(id),
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      platform_user_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS roles (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 1,
      default_scope TEXT NOT NULL DEFAULT 'SELF'
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      role_key TEXT NOT NULL REFERENCES roles(key),
      custom_scope_json TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY,
      role_key TEXT NOT NULL REFERENCES roles(key),
      permission_key TEXT NOT NULL
    );
  `);

  await recordMigrationVersion("001", "core_org_and_identity");

  // --------------------------------------------------------------------------
  // Version 002: Employee Master & History
  // --------------------------------------------------------------------------
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      employee_code TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      department_id TEXT NOT NULL REFERENCES departments(id),
      location_id TEXT NOT NULL REFERENCES locations(id),
      team_id TEXT REFERENCES teams(id),
      manager_id TEXT,
      reporting_hierarchy TEXT NOT NULL DEFAULT '[]',
      job_title TEXT NOT NULL,
      employment_type TEXT NOT NULL DEFAULT 'FULL_TIME',
      probation_status TEXT NOT NULL DEFAULT 'CONFIRMED',
      probation_end_date TEXT,
      joined_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      phone TEXT,
      personal_email TEXT,
      date_of_birth TEXT,
      gender TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      concurrency_version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const employeeCols = [
    { sql: "ALTER TABLE employees ADD COLUMN employee_code TEXT NOT NULL DEFAULT '';", desc: "employees.employee_code" },
    { sql: "ALTER TABLE employees ADD COLUMN probation_status TEXT NOT NULL DEFAULT 'CONFIRMED';", desc: "employees.probation_status" },
    { sql: "ALTER TABLE employees ADD COLUMN probation_end_date TEXT;", desc: "employees.probation_end_date" },
    { sql: "ALTER TABLE employees ADD COLUMN phone TEXT;", desc: "employees.phone" },
    { sql: "ALTER TABLE employees ADD COLUMN personal_email TEXT;", desc: "employees.personal_email" },
    { sql: "ALTER TABLE employees ADD COLUMN date_of_birth TEXT;", desc: "employees.date_of_birth" },
    { sql: "ALTER TABLE employees ADD COLUMN gender TEXT;", desc: "employees.gender" },
    { sql: "ALTER TABLE employees ADD COLUMN emergency_contact_name TEXT;", desc: "employees.emergency_contact_name" },
    { sql: "ALTER TABLE employees ADD COLUMN emergency_contact_phone TEXT;", desc: "employees.emergency_contact_phone" },
    { sql: "ALTER TABLE employees ADD COLUMN concurrency_version INTEGER NOT NULL DEFAULT 1;", desc: "employees.concurrency_version" },
  ];

  for (const col of employeeCols) {
    await executeSafeAlterColumn(col.sql, col.desc);
  }

  // Backfill employee_code with id if empty
  await rawClient.execute(
    "UPDATE employees SET employee_code = id WHERE employee_code = '' OR employee_code IS NULL;"
  );

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS employee_id_configs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      prefix TEXT NOT NULL DEFAULT 'EMP',
      suffix TEXT,
      digit_count INTEGER NOT NULL DEFAULT 3,
      next_sequence INTEGER NOT NULL DEFAULT 1,
      allow_manual_override INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS employee_status_history (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      reason TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      changed_by_user_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS employee_manager_history (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      previous_manager_id TEXT,
      new_manager_id TEXT,
      reason TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      changed_by_user_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
  `);

  await recordMigrationVersion("002", "employee_master_and_history");

  // --------------------------------------------------------------------------
  // Version 003: Documents & Sensitive Details
  // --------------------------------------------------------------------------
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS employee_documents (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      document_type TEXT NOT NULL,
      document_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      storage_path_encrypted TEXT NOT NULL,
      file_hash TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      replaced_document_id TEXT,
      verification_status TEXT NOT NULL DEFAULT 'PENDING',
      verified_by_user_id TEXT REFERENCES users(id),
      verified_at INTEGER,
      rejection_reason TEXT,
      retention_until INTEGER,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const docCols = [
    { sql: "ALTER TABLE employee_documents ADD COLUMN file_hash TEXT;", desc: "employee_documents.file_hash" },
    { sql: "ALTER TABLE employee_documents ADD COLUMN version INTEGER NOT NULL DEFAULT 1;", desc: "employee_documents.version" },
    { sql: "ALTER TABLE employee_documents ADD COLUMN replaced_document_id TEXT;", desc: "employee_documents.replaced_document_id" },
    { sql: "ALTER TABLE employee_documents ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'PENDING';", desc: "employee_documents.verification_status" },
    { sql: "ALTER TABLE employee_documents ADD COLUMN verified_by_user_id TEXT;", desc: "employee_documents.verified_by_user_id" },
    { sql: "ALTER TABLE employee_documents ADD COLUMN verified_at INTEGER;", desc: "employee_documents.verified_at" },
    { sql: "ALTER TABLE employee_documents ADD COLUMN rejection_reason TEXT;", desc: "employee_documents.rejection_reason" },
    { sql: "ALTER TABLE employee_documents ADD COLUMN retention_until INTEGER;", desc: "employee_documents.retention_until" },
  ];
  for (const c of docCols) {
    await executeSafeAlterColumn(c.sql, c.desc);
  }

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS sensitive_employee_details (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL UNIQUE REFERENCES employees(id),
      account_holder_name_encrypted TEXT,
      basic_salary_encrypted TEXT NOT NULL,
      gross_salary_encrypted TEXT NOT NULL,
      net_salary_encrypted TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      bank_account_number_encrypted TEXT NOT NULL,
      bank_ifsc_encrypted TEXT NOT NULL,
      tax_identifier_encrypted TEXT NOT NULL,
      identity_document_number_encrypted TEXT NOT NULL,
      identity_document_url_encrypted TEXT NOT NULL,
      compensation_effective_date TEXT,
      key_version TEXT NOT NULL DEFAULT 'v1',
      version INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
  `);

  const sensitiveCols = [
    { sql: "ALTER TABLE sensitive_employee_details ADD COLUMN account_holder_name_encrypted TEXT;", desc: "sensitive_employee_details.account_holder_name_encrypted" },
    { sql: "ALTER TABLE sensitive_employee_details ADD COLUMN compensation_effective_date TEXT;", desc: "sensitive_employee_details.compensation_effective_date" },
    { sql: "ALTER TABLE sensitive_employee_details ADD COLUMN version INTEGER NOT NULL DEFAULT 1;", desc: "sensitive_employee_details.version" },
  ];
  for (const c of sensitiveCols) {
    await executeSafeAlterColumn(c.sql, c.desc);
  }

  await recordMigrationVersion("003", "documents_and_sensitive_details");

  // --------------------------------------------------------------------------
  // Version 004: Attendance Policies, Shifts & Records
  // --------------------------------------------------------------------------
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS attendance_policies (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      grace_period_minutes INTEGER NOT NULL DEFAULT 15,
      half_day_threshold_minutes INTEGER NOT NULL DEFAULT 240,
      full_day_threshold_minutes INTEGER NOT NULL DEFAULT 480,
      allow_flexible_hours INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      break_duration_minutes INTEGER NOT NULL DEFAULT 60,
      is_overnight INTEGER NOT NULL DEFAULT 0,
      color_code TEXT NOT NULL DEFAULT '#36B4FF',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS shift_assignments (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      shift_id TEXT NOT NULL REFERENCES shifts(id),
      start_date TEXT NOT NULL,
      end_date TEXT,
      pattern_days TEXT NOT NULL DEFAULT '["MON","TUE","WED","THU","FRI"]',
      assigned_by_user_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS shift_history (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      previous_shift_id TEXT,
      new_shift_id TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      changed_by_user_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      date TEXT NOT NULL,
      shift_id TEXT REFERENCES shifts(id),
      check_in_time_utc TEXT,
      check_out_time_utc TEXT,
      total_work_minutes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PRESENT',
      late_minutes INTEGER NOT NULL DEFAULT 0,
      early_exit_minutes INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'WEB',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS attendance_events (
      id TEXT PRIMARY KEY,
      attendance_record_id TEXT NOT NULL REFERENCES attendance_records(id),
      employee_id TEXT NOT NULL REFERENCES employees(id),
      event_type TEXT NOT NULL,
      timestamp_utc TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'WEB',
      ip_address TEXT,
      device_info TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS attendance_correction_requests (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      attendance_record_id TEXT REFERENCES attendance_records(id),
      requested_date TEXT NOT NULL,
      requested_check_in_utc TEXT NOT NULL,
      requested_check_out_utc TEXT NOT NULL,
      conflict_field TEXT,
      current_value TEXT,
      requested_value TEXT,
      proof_link TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by_user_id TEXT REFERENCES users(id),
      reviewed_at INTEGER,
      rejection_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const correctionCols = [
    { sql: "ALTER TABLE attendance_correction_requests ADD COLUMN conflict_field TEXT;", desc: "attendance_correction_requests.conflict_field" },
    { sql: "ALTER TABLE attendance_correction_requests ADD COLUMN current_value TEXT;", desc: "attendance_correction_requests.current_value" },
    { sql: "ALTER TABLE attendance_correction_requests ADD COLUMN requested_value TEXT;", desc: "attendance_correction_requests.requested_value" },
    { sql: "ALTER TABLE attendance_correction_requests ADD COLUMN proof_link TEXT;", desc: "attendance_correction_requests.proof_link" },
  ];
  for (const col of correctionCols) {
    await executeSafeAlterColumn(col.sql, col.desc);
  }

  await recordMigrationVersion("004", "attendance_and_shifts");

  // --------------------------------------------------------------------------
  // Version 005: Auth Credentials, OTP, Reset Tokens, Sessions & Audit
  // --------------------------------------------------------------------------
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS used_tokens (
      token_hash TEXT PRIMARY KEY,
      used_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

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

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      actor_user_id TEXT NOT NULL,
      actor_employee_id TEXT,
      action TEXT NOT NULL,
      target_entity TEXT NOT NULL,
      target_id TEXT NOT NULL,
      changes_json TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      prev_hash TEXT NOT NULL,
      current_hash TEXT NOT NULL
    );
  `);

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

  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      is_used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);

  await recordMigrationVersion("005", "auth_credentials_otp_reset_and_audit");

  // --------------------------------------------------------------------------
  // Version 006: Performance and Security Indexes
  // --------------------------------------------------------------------------
  await rawClient.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_otp_challenges_token ON otp_challenges(challenge_token);"
  );
  await rawClient.execute(
    "CREATE INDEX IF NOT EXISTS idx_otp_challenges_user_active ON otp_challenges(user_id, is_used, expires_at);"
  );
  await rawClient.execute(
    "CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON auth_sessions(user_id, revoked_at, expires_at);"
  );
  await rawClient.execute(
    "CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token_hash);"
  );
  await rawClient.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);"
  );
  await rawClient.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);"
  );

  await recordMigrationVersion("006", "performance_and_security_indexes");

  console.log("Turso schema migration completed successfully with full version audit trail.");
}

async function recordMigrationVersion(version: string, name: string) {
  const checksum = `chk_${version}_${name}`;
  await rawClient.execute({
    sql: `INSERT OR REPLACE INTO schema_migrations (id, version, name, applied_at, checksum)
          VALUES (?, ?, ?, ?, ?);`,
    args: [`mig_${version}`, version, name, Date.now(), checksum],
  });
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
