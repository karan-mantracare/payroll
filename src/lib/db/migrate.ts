import { rawClient } from "./client";

export async function runMigrations() {
  console.log("Running Turso / SQLite table initializations...");

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
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      department_id TEXT NOT NULL REFERENCES departments(id),
      location_id TEXT NOT NULL REFERENCES locations(id),
      team_id TEXT REFERENCES teams(id),
      manager_id TEXT,
      reporting_hierarchy TEXT NOT NULL DEFAULT '[]',
      job_title TEXT NOT NULL,
      employment_type TEXT NOT NULL DEFAULT 'FULL_TIME',
      joined_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Sensitive Details
  await rawClient.execute(`
    CREATE TABLE IF NOT EXISTS sensitive_employee_details (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL UNIQUE REFERENCES employees(id),
      basic_salary REAL NOT NULL,
      gross_salary REAL NOT NULL,
      net_salary REAL NOT NULL,
      bank_name TEXT NOT NULL,
      bank_account_number TEXT NOT NULL,
      bank_ifsc TEXT NOT NULL,
      tax_identifier TEXT NOT NULL,
      identity_document_number TEXT NOT NULL,
      identity_document_url TEXT NOT NULL,
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
