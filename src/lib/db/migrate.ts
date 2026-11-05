import { rawClient } from "./client";

export async function runMigrations() {
  console.log("Running Turso / SQLite table initializations...");

  try {
    await rawClient.execute("PRAGMA journal_mode = WAL;");
    await rawClient.execute("PRAGMA busy_timeout = 5000;");
  } catch {}

  // Organizations
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
  `);

  // Departments
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Locations
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

  // Teams
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL REFERENCES departments(id),
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Users
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

  // Employees
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

  // Migrate additional columns for existing tables
  const employeeCols = [
    "ALTER TABLE employees ADD COLUMN employee_code TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE employees ADD COLUMN probation_status TEXT NOT NULL DEFAULT 'CONFIRMED';",
    "ALTER TABLE employees ADD COLUMN probation_end_date TEXT;",
    "ALTER TABLE employees ADD COLUMN phone TEXT;",
    "ALTER TABLE employees ADD COLUMN personal_email TEXT;",
    "ALTER TABLE employees ADD COLUMN date_of_birth TEXT;",
    "ALTER TABLE employees ADD COLUMN gender TEXT;",
    "ALTER TABLE employees ADD COLUMN emergency_contact_name TEXT;",
    "ALTER TABLE employees ADD COLUMN emergency_contact_phone TEXT;",
    "ALTER TABLE employees ADD COLUMN concurrency_version INTEGER NOT NULL DEFAULT 1;",
  ];

  for (const colSql of employeeCols) {
    try {
      await rawClient.execute(colSql);
    } catch {}
  }

  // Backfill employee_code with id if empty
  try {
    await rawClient.execute(`UPDATE employees SET employee_code = id WHERE employee_code = '' OR employee_code IS NULL;`);
  } catch {}

  // Employee ID Configuration
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

  // Employee Status Transitions History
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

  // Employee Reporting Manager History
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

  // Employee Documents
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

  // Document table column migrations
  const docCols = [
    "ALTER TABLE employee_documents ADD COLUMN file_hash TEXT;",
    "ALTER TABLE employee_documents ADD COLUMN version INTEGER NOT NULL DEFAULT 1;",
    "ALTER TABLE employee_documents ADD COLUMN replaced_document_id TEXT;",
    "ALTER TABLE employee_documents ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'PENDING';",
    "ALTER TABLE employee_documents ADD COLUMN verified_by_user_id TEXT;",
    "ALTER TABLE employee_documents ADD COLUMN verified_at INTEGER;",
    "ALTER TABLE employee_documents ADD COLUMN rejection_reason TEXT;",
    "ALTER TABLE employee_documents ADD COLUMN retention_until INTEGER;",
  ];
  for (const c of docCols) {
    try {
      await rawClient.execute(c);
    } catch {}
  }

  // Sensitive Details (AES-256-GCM Encrypted at rest)
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
    "ALTER TABLE sensitive_employee_details ADD COLUMN account_holder_name_encrypted TEXT;",
    "ALTER TABLE sensitive_employee_details ADD COLUMN compensation_effective_date TEXT;",
    "ALTER TABLE sensitive_employee_details ADD COLUMN version INTEGER NOT NULL DEFAULT 1;",
  ];
  for (const c of sensitiveCols) {
    try {
      await rawClient.execute(c);
    } catch {}
  }

  // Phase 3: Attendance Policies
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

  // Phase 3: Shifts
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

  // Phase 3: Shift Assignments
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

  // Phase 3: Shift History
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

  // Phase 3: Attendance Records
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

  // Phase 3: Attendance Events Log
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

  // Phase 3: Attendance Correction Requests
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS attendance_correction_requests (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      attendance_record_id TEXT REFERENCES attendance_records(id),
      requested_date TEXT NOT NULL,
      requested_check_in_utc TEXT NOT NULL,
      requested_check_out_utc TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by_user_id TEXT REFERENCES users(id),
      reviewed_at INTEGER,
      rejection_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);


  // Roles
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS roles (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 1,
      default_scope TEXT NOT NULL DEFAULT 'SELF'
    );
  `);

  // User Roles
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      role_key TEXT NOT NULL REFERENCES roles(key),
      custom_scope_json TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Role Permissions
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY,
      role_key TEXT NOT NULL REFERENCES roles(key),
      permission_key TEXT NOT NULL
    );
  `);

  // Used Tokens (Replay Protection)
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS used_tokens (
      token_hash TEXT PRIMARY KEY,
      used_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

  // Auth Sessions
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

  // Audit Logs
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

  console.log("Turso schema migration completed successfully.");
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}

