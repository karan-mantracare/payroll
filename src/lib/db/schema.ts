import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// 1. Organizations
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

// 2. Departments
export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  createdAt: integer("created_at").notNull(),
});

// 3. Locations
export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull().default("India"),
  createdAt: integer("created_at").notNull(),
});

// 4. Teams
export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  departmentId: text("department_id")
    .notNull()
    .references(() => departments.id),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

// 5. Users (MantraCare Platform Identity mapping)
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // Internal HRMS user ID
  platformUserId: text("platform_user_id").notNull().unique(), // ID returned by api.mantracare.com/user/user-info
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, SUSPENDED, INACTIVE
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 6. Employees (Core HR profile)
export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(), // Internal UUID
  employeeCode: text("employee_code").notNull().unique(), // Unique, immutable business employee ID (e.g. EMP-001, MC-042)
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  departmentId: text("department_id")
    .notNull()
    .references(() => departments.id),
  locationId: text("location_id")
    .notNull()
    .references(() => locations.id),
  teamId: text("team_id").references(() => teams.id),
  managerId: text("manager_id"), // Self-referencing manager employee UUID
  reportingHierarchy: text("reporting_hierarchy").notNull().default("[]"), // JSON stringified array of ancestor employee IDs
  jobTitle: text("job_title").notNull(), // Designation
  employmentType: text("employment_type").notNull().default("FULL_TIME"), // FULL_TIME, PART_TIME, CONTRACT, INTERN
  probationStatus: text("probation_status").notNull().default("CONFIRMED"), // IN_PROBATION, CONFIRMED, EXTENDED, WAIVED
  probationEndDate: text("probation_end_date"),
  joinedDate: text("joined_date").notNull(),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, ON_LEAVE, PROBATION, SUSPENDED, TERMINATED
  phone: text("phone"),
  personalEmail: text("personal_email"),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  concurrencyVersion: integer("concurrency_version").notNull().default(1),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 6b. Configurable Employee ID Generation Settings
export const employeeIdConfigs = sqliteTable("employee_id_configs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  prefix: text("prefix").notNull().default("EMP"),
  suffix: text("suffix"),
  digitCount: integer("digit_count").notNull().default(3),
  nextSequence: integer("next_sequence").notNull().default(1),
  allowManualOverride: integer("allow_manual_override", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at").notNull(),
});

// 6c. Employment Status Transitions History
export const employeeStatusHistory = sqliteTable("employee_status_history", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  previousStatus: text("previous_status").notNull(),
  newStatus: text("new_status").notNull(),
  reason: text("reason").notNull(),
  effectiveDate: text("effective_date").notNull(),
  changedByUserId: text("changed_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at").notNull(),
});

// 6d. Reporting Manager Change History
export const employeeManagerHistory = sqliteTable("employee_manager_history", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  previousManagerId: text("previous_manager_id"),
  newManagerId: text("new_manager_id"),
  reason: text("reason").notNull(),
  effectiveDate: text("effective_date").notNull(),
  changedByUserId: text("changed_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at").notNull(),
});

// 6e. Employee Documents Vault
export const employeeDocuments = sqliteTable("employee_documents", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  documentType: text("document_type").notNull(), // ID_PROOF, OFFER_LETTER, TAX_EXEMPTION, RESUME, CONTRACT, OTHER
  documentName: text("document_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  storagePathEncrypted: text("storage_path_encrypted").notNull(),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, ARCHIVED, EXPIRED
  uploadedByUserId: text("uploaded_by_user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 7. Sensitive Employee Financial & Identity Details (Encrypted at rest with AES-256-GCM)
export const sensitiveEmployeeDetails = sqliteTable("sensitive_employee_details", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .unique()
    .references(() => employees.id),
  basicSalaryEncrypted: text("basic_salary_encrypted").notNull(),
  grossSalaryEncrypted: text("gross_salary_encrypted").notNull(),
  netSalaryEncrypted: text("net_salary_encrypted").notNull(),
  bankName: text("bank_name").notNull(),
  bankAccountNumberEncrypted: text("bank_account_number_encrypted").notNull(),
  bankIfscEncrypted: text("bank_ifsc_encrypted").notNull(),
  taxIdentifierEncrypted: text("tax_identifier_encrypted").notNull(), // PAN, SSN, Tax ID
  identityDocumentNumberEncrypted: text("identity_document_number_encrypted").notNull(),
  identityDocumentUrlEncrypted: text("identity_document_url_encrypted").notNull(),
  keyVersion: text("key_version").notNull().default("v1"),
  version: integer("version").notNull().default(1), // Monotonic concurrency marker
  updatedAt: integer("updated_at").notNull(),
});

// 8. Roles
export const roles = sqliteTable("roles", {
  key: text("key").primaryKey(), // e.g. "SUPER_ADMIN", "ADMIN", "HR_MANAGER", "HR_EXECUTIVE", "TEAM_MANAGER", "EMPLOYEE"
  name: text("name").notNull(),
  description: text("description").notNull(),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(true),
  defaultScope: text("default_scope").notNull().default("SELF"),
});

// 9. User Roles Mapping (Supports multiple roles per user & custom scope rules)
export const userRoles = sqliteTable("user_roles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  roleKey: text("role_key")
    .notNull()
    .references(() => roles.key),
  customScopeJson: text("custom_scope_json"), // JSON for custom scopes or override departments/teams
  createdAt: integer("created_at").notNull(),
});

// 10. Role Permissions
export const rolePermissions = sqliteTable("role_permissions", {
  id: text("id").primaryKey(),
  roleKey: text("role_key")
    .notNull()
    .references(() => roles.key),
  permissionKey: text("permission_key").notNull(),
});

// 11. Used Bootstrap Tokens (Token Replay Prevention)
export const usedTokens = sqliteTable("used_tokens", {
  tokenHash: text("token_hash").primaryKey(), // SHA-256 of the token
  usedAt: integer("used_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

// 12. Authenticated Application Sessions (Server-side Session Store)
export const authSessions = sqliteTable("auth_sessions", {
  sessionId: text("session_id").primaryKey(), // Cryptographically random 64-char token
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"), // Set when explicitly logged out
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

// 13. Audit Logs (Append-Only Tamper-Evident Hash Chain)
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), // Monotonic counter or ordered UUID
  timestamp: integer("timestamp").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  actorEmployeeId: text("actor_employee_id"),
  action: text("action").notNull(), // e.g. "USER_LOGIN", "ROLE_ASSIGNED", "SALARY_UPDATED"
  targetEntity: text("target_entity").notNull(), // e.g. "employees", "sensitive_details"
  targetId: text("target_id").notNull(),
  changesJson: text("changes_json").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  prevHash: text("prev_hash").notNull(), // SHA-256 of previous audit record
  currentHash: text("current_hash").notNull(), // SHA-256 of (prevHash + payload)
});

