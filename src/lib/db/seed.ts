import { rawClient } from "./client";
import { runMigrations } from "./migrate";
import { DEFAULT_ROLES } from "../permissions/registry";
import { encryptField } from "../security/crypto";
import { hashPassword } from "../security/password";

export async function seedDatabase() {
  await runMigrations();
  console.log("Seeding MantraCare HRMS & Payroll database...");

  const now = Date.now();

  // Clear transactional/variable tables for test reproducibility
  await rawClient.execute("DELETE FROM audit_logs;");
  await rawClient.execute("DELETE FROM auth_sessions;");
  await rawClient.execute("DELETE FROM used_tokens;");
  await rawClient.execute("DELETE FROM otp_challenges;");
  await rawClient.execute("DELETE FROM user_credentials;");
  await rawClient.execute("DELETE FROM attendance_events;");
  await rawClient.execute("DELETE FROM attendance_correction_requests;");
  await rawClient.execute("DELETE FROM attendance_records;");
  await rawClient.execute("DELETE FROM shift_history;");
  await rawClient.execute("DELETE FROM shift_assignments;");
  await rawClient.execute("DELETE FROM shifts;");
  await rawClient.execute("DELETE FROM attendance_policies;");
  await rawClient.execute("DELETE FROM employee_documents;");
  await rawClient.execute("DELETE FROM employee_status_history;");
  await rawClient.execute("DELETE FROM employee_manager_history;");
  await rawClient.execute("DELETE FROM sensitive_employee_details;");
  await rawClient.execute("DELETE FROM user_roles;");
  await rawClient.execute("DELETE FROM employees;");
  await rawClient.execute("DELETE FROM users;");
  await rawClient.execute("DELETE FROM employee_id_configs;");

  // 1. Organizations
  await rawClient.execute({
    sql: `INSERT OR REPLACE INTO organizations (id, name, slug, created_at)
          VALUES ('org_mc_global', 'MantraCare Global Technologies', 'mantracare', ?);`,
    args: [now],
  });

  // 2. Departments
  await rawClient.execute({
    sql: `INSERT OR REPLACE INTO departments (id, organization_id, name, code, created_at) VALUES
          ('dept_eng', 'org_mc_global', 'Engineering & Tech', 'ENG', ?),
          ('dept_hr', 'org_mc_global', 'Human Resources', 'HR', ?),
          ('dept_fin', 'org_mc_global', 'Finance & Payroll', 'FIN', ?);`,
    args: [now, now, now],
  });

  // 3. Locations
  await rawClient.execute({
    sql: `INSERT OR REPLACE INTO locations (id, organization_id, name, city, country, created_at) VALUES
          ('loc_delhi', 'org_mc_global', 'Delhi Corporate HQ', 'New Delhi', 'India', ?),
          ('loc_blr', 'org_mc_global', 'Bangalore Tech Center', 'Bangalore', 'India', ?),
          ('loc_remote', 'org_mc_global', 'Global Remote', 'Remote', 'Global', ?);`,
    args: [now, now, now],
  });

  // 4. Teams
  await rawClient.execute({
    sql: `INSERT OR REPLACE INTO teams (id, department_id, name, created_at) VALUES
          ('team_fe', 'dept_eng', 'Frontend Applications', ?),
          ('team_be', 'dept_eng', 'Backend & Security', ?),
          ('team_hr_ops', 'dept_hr', 'People Operations', ?);`,
    args: [now, now, now],
  });

  // 4b. Configurable Employee ID Generation Rule
  await rawClient.execute({
    sql: `INSERT OR REPLACE INTO employee_id_configs (id, organization_id, prefix, suffix, digit_count, next_sequence, allow_manual_override, updated_at)
          VALUES ('cfg_id_org_mc_global', 'org_mc_global', 'EMP', '', 3, 12, 1, ?);`,
    args: [now],
  });

  // 4c. Attendance Policy
  await rawClient.execute({
    sql: `INSERT OR REPLACE INTO attendance_policies (id, organization_id, name, grace_period_minutes, half_day_threshold_minutes, full_day_threshold_minutes, allow_flexible_hours, created_at, updated_at)
          VALUES ('policy_default', 'org_mc_global', 'Standard Corporate Attendance Policy', 15, 240, 480, 0, ?, ?);`,
    args: [now, now],
  });

  // 4d. Standard Shifts
  await rawClient.execute({
    sql: `INSERT OR REPLACE INTO shifts (id, organization_id, name, code, start_time, end_time, break_duration_minutes, is_overnight, color_code, is_active, created_at, updated_at) VALUES
          ('shift_gen', 'org_mc_global', 'General Day Shift', 'GENERAL', '09:00', '18:00', 60, 0, '#36B4FF', 1, ?, ?),
          ('shift_morn', 'org_mc_global', 'Early Morning Shift', 'MORNING', '06:00', '15:00', 60, 0, '#293381', 1, ?, ?),
          ('shift_night', 'org_mc_global', 'Overnight Shift', 'NIGHT', '21:00', '06:00', 60, 1, '#6366F1', 1, ?, ?);`,
    args: [now, now, now, now, now, now],
  });

  // 5. Default Roles & Permissions
  for (const [key, role] of Object.entries(DEFAULT_ROLES)) {
    await rawClient.execute({
      sql: `INSERT OR REPLACE INTO roles (key, name, description, is_system, default_scope)
            VALUES (?, ?, ?, ?, ?);`,
      args: [role.key, role.name, role.description, 1, role.defaultScope],
    });

    for (const perm of role.permissions) {
      const permId = `perm_${role.key}_${perm}`;
      await rawClient.execute({
        sql: `INSERT OR REPLACE INTO role_permissions (id, role_key, permission_key)
              VALUES (?, ?, ?);`,
        args: [permId, role.key, perm],
      });
    }
  }

  // 6. Seed Users
  const seedUsers = [
    {
      id: "usr_superadmin",
      platformUserId: "plt_superadmin",
      name: "Siddharth SuperAdmin",
      email: "superadmin@mantracare.com",
      role: "SUPER_ADMIN",
      empId: "EMP-001",
      title: "Chief Executive Officer & SuperAdmin",
      dept: "dept_hr",
      team: "team_hr_ops",
      loc: "loc_delhi",
      manager: null,
      hierarchy: "[]",
      basic: 350000,
      gross: 420000,
      net: 320000,
      bankAcc: "987654321001",
      taxId: "AAAPL0001S",
    },
    {
      id: "usr_admin",
      platformUserId: "plt_admin",
      name: "Aakash Admin",
      email: "admin@mantracare.com",
      role: "ADMIN",
      empId: "EMP-002",
      title: "Head of Operations & Payroll Admin",
      dept: "dept_fin",
      team: null,
      loc: "loc_delhi",
      manager: "EMP-001",
      hierarchy: '["EMP-001"]',
      basic: 220000,
      gross: 260000,
      net: 205000,
      bankAcc: "987654321002",
      taxId: "AAAPL0002A",
    },
    {
      id: "usr_hrmanager",
      platformUserId: "plt_hrmanager",
      name: "Meera HR-Manager",
      email: "hrmanager@mantracare.com",
      role: "HR_MANAGER",
      empId: "EMP-003",
      title: "Senior HR Manager",
      dept: "dept_hr",
      team: "team_hr_ops",
      loc: "loc_delhi",
      manager: "EMP-001",
      hierarchy: '["EMP-001"]',
      basic: 160000,
      gross: 195000,
      net: 152000,
      bankAcc: "987654321003",
      taxId: "AAAPL0003M",
    },
    {
      id: "usr_hrexecutive",
      platformUserId: "plt_hrexecutive",
      name: "Kavita HR-Executive",
      email: "hrexecutive@mantracare.com",
      role: "HR_EXECUTIVE",
      empId: "EMP-004",
      title: "HR Operations Executive",
      dept: "dept_hr",
      team: "team_hr_ops",
      loc: "loc_delhi",
      manager: "EMP-003",
      hierarchy: '["EMP-003", "EMP-001"]',
      basic: 85000,
      gross: 105000,
      net: 82000,
      bankAcc: "987654321004",
      taxId: "AAAPL0004K",
    },
    {
      id: "usr_teammanager",
      platformUserId: "plt_teammanager",
      name: "Vikram Team-Lead",
      email: "teammanager@mantracare.com",
      role: "TEAM_MANAGER",
      empId: "EMP-005",
      title: "Engineering Team Lead",
      dept: "dept_eng",
      team: "team_fe",
      loc: "loc_blr",
      manager: "EMP-002",
      hierarchy: '["EMP-002", "EMP-001"]',
      basic: 190000,
      gross: 230000,
      net: 180000,
      bankAcc: "987654321005",
      taxId: "AAAPL0005V",
    },
    {
      id: "usr_employee",
      platformUserId: "plt_employee",
      name: "Rohan Employee",
      email: "employee@mantracare.com",
      role: "EMPLOYEE",
      empId: "EMP-006",
      title: "Senior Frontend Engineer",
      dept: "dept_eng",
      team: "team_fe",
      loc: "loc_blr",
      manager: "EMP-005", // Reports to Vikram
      hierarchy: '["EMP-005", "EMP-002", "EMP-001"]',
      basic: 120000,
      gross: 145000,
      net: 115000,
      bankAcc: "987654321006",
      taxId: "AAAPL0006R",
    },
    {
      id: "usr_multirole",
      platformUserId: "plt_multirole",
      name: "Ananya Multi-Role",
      email: "multirole@mantracare.com",
      role: "EMPLOYEE", // Will also be assigned TEAM_MANAGER and ADMIN
      empId: "EMP-007",
      title: "Lead Architect & Admin",
      dept: "dept_eng",
      team: "team_be",
      loc: "loc_delhi",
      manager: "EMP-001",
      hierarchy: '["EMP-001"]',
      basic: 240000,
      gross: 290000,
      net: 228000,
      bankAcc: "987654321007",
      taxId: "AAAPL0007A",
    },
    // 4 Temporary Logins (Requested for Testing)
    {
      id: "usr_temp_admin",
      platformUserId: "plt_temp_admin",
      name: "Admin Mantra",
      email: "admin@mantra.care",
      role: "ADMIN",
      empId: "EMP-008",
      title: "Operations & Payroll Administrator",
      dept: "dept_fin",
      team: null,
      loc: "loc_delhi",
      manager: "EMP-001",
      hierarchy: '["EMP-001"]',
      password: "Test@2026",
      basic: 250000,
      gross: 300000,
      net: 240000,
      bankAcc: "987654321008",
      taxId: "AAAPL0008A",
    },
    {
      id: "usr_temp_hrm",
      platformUserId: "plt_temp_hrm",
      name: "HRM Mantra",
      email: "hrm@mantra.care",
      role: "HR_MANAGER",
      empId: "EMP-009",
      title: "Human Resources Manager",
      dept: "dept_hr",
      team: "team_hr_ops",
      loc: "loc_delhi",
      manager: "EMP-001",
      hierarchy: '["EMP-001"]',
      password: "Test@2026",
      basic: 180000,
      gross: 220000,
      net: 175000,
      bankAcc: "987654321009",
      taxId: "AAAPL0009H",
    },
    {
      id: "usr_temp_hrt",
      platformUserId: "plt_temp_hrt",
      name: "HRT Mantra",
      email: "hrt@mantra.care",
      role: "HR_EXECUTIVE",
      empId: "EMP-010",
      title: "HR Executive / Talent Specialist",
      dept: "dept_hr",
      team: "team_hr_ops",
      loc: "loc_delhi",
      manager: "EMP-009",
      hierarchy: '["EMP-009", "EMP-001"]',
      password: "Test@2026",
      basic: 95000,
      gross: 115000,
      net: 90000,
      bankAcc: "987654321010",
      taxId: "AAAPL0010T",
    },
    {
      id: "usr_temp_emp",
      platformUserId: "plt_temp_emp",
      name: "Employee Mantra",
      email: "emp@mantra.care",
      role: "EMPLOYEE",
      empId: "EMP-011",
      title: "Senior Software Engineer",
      dept: "dept_eng",
      team: "team_fe",
      loc: "loc_blr",
      manager: "EMP-005",
      hierarchy: '["EMP-005", "EMP-002", "EMP-001"]',
      password: "Test@2026",
      basic: 130000,
      gross: 155000,
      net: 122000,
      bankAcc: "987654321011",
      taxId: "AAAPL0011E",
    },
  ];

  for (const u of seedUsers) {
    // Insert User
    await rawClient.execute({
      sql: `INSERT OR REPLACE INTO users (id, platform_user_id, email, name, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?);`,
      args: [u.id, u.platformUserId, u.email, u.name, now, now],
    });

    // Insert User Credentials
    const userPassword = (u as any).password || "MantraCare@2026!";
    const devPasswordHash = await hashPassword(userPassword, 12);
    await rawClient.execute({
      sql: `INSERT OR REPLACE INTO user_credentials
            (id, user_id, password_hash, password_updated_at, failed_login_attempts, locked_until, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, NULL, ?, ?);`,
      args: [`cred_${u.id}`, u.id, devPasswordHash, now, now, now],
    });

    // Insert Employee Profile
    await rawClient.execute({
      sql: `INSERT OR REPLACE INTO employees
            (id, employee_code, user_id, organization_id, department_id, location_id, team_id, manager_id, reporting_hierarchy, job_title, employment_type, probation_status, joined_date, status, phone, personal_email, concurrency_version, created_at, updated_at)
            VALUES (?, ?, ?, 'org_mc_global', ?, ?, ?, ?, ?, ?, 'FULL_TIME', 'CONFIRMED', '2024-01-15', 'ACTIVE', '+91 98765 43210', ?, 1, ?, ?);`,
      args: [
        u.empId,
        u.empId,
        u.id,
        u.dept,
        u.loc,
        u.team,
        u.manager,
        u.hierarchy,
        u.title,
        u.email,
        now,
        now,
      ],
    });

    // Insert Sensitive Financial Details (AES-256-GCM Encrypted at rest)
    await rawClient.execute({
      sql: `INSERT OR REPLACE INTO sensitive_employee_details
            (id, employee_id, basic_salary_encrypted, gross_salary_encrypted, net_salary_encrypted, bank_name, bank_account_number_encrypted, bank_ifsc_encrypted, tax_identifier_encrypted, identity_document_number_encrypted, identity_document_url_encrypted, key_version, version, updated_at)
            VALUES (?, ?, ?, ?, ?, 'HDFC Bank', ?, ?, ?, ?, ?, 'v1', 1, ?);`,
      args: [
        `sens_${u.empId}`,
        u.empId,
        encryptField(u.basic),
        encryptField(u.gross),
        encryptField(u.net),
        encryptField(u.bankAcc),
        encryptField("HDFC0001234"),
        encryptField(u.taxId),
        encryptField("IND-ID-99901"),
        encryptField("https://secure.mantracare.com/docs/id.pdf"),
        now,
      ],
    });

    // Assign Role
    await rawClient.execute({
      sql: `INSERT OR REPLACE INTO user_roles (id, user_id, role_key, custom_scope_json, created_at)
            VALUES (?, ?, ?, NULL, ?);`,
      args: [`ur_${u.id}_${u.role}`, u.id, u.role, now],
    });
  }

  // Assign multiple roles to usr_multirole (Employee + Team Manager + Admin)
  await rawClient.execute({
    sql: `INSERT OR REPLACE INTO user_roles (id, user_id, role_key, custom_scope_json, created_at)
          VALUES ('ur_multirole_tm', 'usr_multirole', 'TEAM_MANAGER', NULL, ?);`,
    args: [now],
  });
  await rawClient.execute({
    sql: `INSERT OR REPLACE INTO user_roles (id, user_id, role_key, custom_scope_json, created_at)
          VALUES ('ur_multirole_admin', 'usr_multirole', 'ADMIN', NULL, ?);`,
    args: [now],
  });

  // Assign shifts to all seed employees
  for (const u of seedUsers) {
    await rawClient.execute({
      sql: `INSERT OR REPLACE INTO shift_assignments (id, employee_id, shift_id, start_date, end_date, pattern_days, assigned_by_user_id, created_at, updated_at)
            VALUES (?, ?, 'shift_gen', '2026-01-01', NULL, '["MON","TUE","WED","THU","FRI"]', 'usr_admin', ?, ?);`,
      args: [`sa_${u.empId}`, u.empId, now, now],
    });
  }

  console.log("Database seeded successfully with default roles and test users!");
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}

