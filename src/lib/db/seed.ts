import { rawClient } from "./client";
import { runMigrations } from "./migrate";
import { DEFAULT_ROLES } from "../permissions/registry";
import { encryptField } from "../security/crypto";

export async function seedDatabase() {
  await runMigrations();
  console.log("Seeding MantraCare HRMS & Payroll database...");

  const now = Date.now();

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
  ];

  for (const u of seedUsers) {
    // Insert User
    await rawClient.execute({
      sql: `INSERT OR REPLACE INTO users (id, platform_user_id, email, name, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?);`,
      args: [u.id, u.platformUserId, u.email, u.name, now, now],
    });

    // Insert Employee Profile
    await rawClient.execute({
      sql: `INSERT OR REPLACE INTO employees
            (id, user_id, organization_id, department_id, location_id, team_id, manager_id, reporting_hierarchy, job_title, employment_type, joined_date, status, created_at, updated_at)
            VALUES (?, ?, 'org_mc_global', ?, ?, ?, ?, ?, ?, 'FULL_TIME', '2024-01-15', 'ACTIVE', ?, ?);`,
      args: [
        u.empId,
        u.id,
        u.dept,
        u.loc,
        u.team,
        u.manager,
        u.hierarchy,
        u.title,
        now,
        now,
      ],
    });

    // Insert Sensitive Financial Details (AES-256-GCM Encrypted at rest)
    await rawClient.execute({
      sql: `INSERT OR REPLACE INTO sensitive_employee_details
            (id, employee_id, basic_salary_encrypted, gross_salary_encrypted, net_salary_encrypted, bank_name, bank_account_number_encrypted, bank_ifsc_encrypted, tax_identifier_encrypted, identity_document_number_encrypted, identity_document_url_encrypted, key_version, updated_at)
            VALUES (?, ?, ?, ?, ?, 'HDFC Bank', ?, ?, ?, ?, ?, 'v1', ?);`,
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

