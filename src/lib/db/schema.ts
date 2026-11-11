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
  documentType: text("document_type").notNull(), // AADHAAR_ID, PAN_TAX_ID, ADDRESS_PROOF, APPOINTMENT_LETTER, EMPLOYMENT_AGREEMENT, EDUCATIONAL_CERTIFICATE, EXPERIENCE_LETTER, RELIEVING_LETTER, SALARY_REVISION_LETTER, OTHER_HR_DOCUMENT
  documentName: text("document_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  storagePathEncrypted: text("storage_path_encrypted").notNull(),
  fileHash: text("file_hash"), // SHA-256 integrity hash
  version: integer("version").notNull().default(1),
  replacedDocumentId: text("replaced_document_id"),
  verificationStatus: text("verification_status").notNull().default("PENDING"), // PENDING, VERIFIED, REJECTED
  verifiedByUserId: text("verified_by_user_id").references(() => users.id),
  verifiedAt: integer("verified_at"),
  rejectionReason: text("rejection_reason"),
  retentionUntil: integer("retention_until"),
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
  accountHolderNameEncrypted: text("account_holder_name_encrypted"),
  basicSalaryEncrypted: text("basic_salary_encrypted").notNull(),
  grossSalaryEncrypted: text("gross_salary_encrypted").notNull(),
  netSalaryEncrypted: text("net_salary_encrypted").notNull(),
  bankName: text("bank_name").notNull(),
  bankAccountNumberEncrypted: text("bank_account_number_encrypted").notNull(),
  bankIfscEncrypted: text("bank_ifsc_encrypted").notNull(),
  taxIdentifierEncrypted: text("tax_identifier_encrypted").notNull(), // PAN, SSN, Tax ID
  identityDocumentNumberEncrypted: text("identity_document_number_encrypted").notNull(),
  identityDocumentUrlEncrypted: text("identity_document_url_encrypted").notNull(),
  compensationEffectiveDate: text("compensation_effective_date"),
  keyVersion: text("key_version").notNull().default("v1"),
  version: integer("version").notNull().default(1), // Monotonic concurrency marker
  updatedAt: integer("updated_at").notNull(),
});

// 7b. Attendance Policies
export const attendancePolicies = sqliteTable("attendance_policies", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  gracePeriodMinutes: integer("grace_period_minutes").notNull().default(15),
  halfDayThresholdMinutes: integer("half_day_threshold_minutes").notNull().default(240),
  fullDayThresholdMinutes: integer("full_day_threshold_minutes").notNull().default(480),
  allowFlexibleHours: integer("allow_flexible_hours", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 7c. Shifts Definition
export const shifts = sqliteTable("shifts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // e.g. "GENERAL", "MORNING", "NIGHT"
  startTime: text("start_time").notNull(), // "HH:mm" e.g. "09:00"
  endTime: text("end_time").notNull(), // "HH:mm" e.g. "18:00"
  breakDurationMinutes: integer("break_duration_minutes").notNull().default(60),
  isOvernight: integer("is_overnight", { mode: "boolean" }).notNull().default(false),
  colorCode: text("color_code").notNull().default("#36B4FF"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 7d. Employee Shift Assignments
export const shiftAssignments = sqliteTable("shift_assignments", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  shiftId: text("shift_id")
    .notNull()
    .references(() => shifts.id),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date"), // YYYY-MM-DD (null for ongoing)
  patternDays: text("pattern_days").notNull().default('["MON","TUE","WED","THU","FRI"]'),
  assignedByUserId: text("assigned_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 7e. Shift Change History
export const shiftHistory = sqliteTable("shift_history", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  previousShiftId: text("previous_shift_id"),
  newShiftId: text("new_shift_id").notNull(),
  effectiveDate: text("effective_date").notNull(),
  reason: text("reason").notNull(),
  changedByUserId: text("changed_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at").notNull(),
});

// 7f. Daily Attendance Records
export const attendanceRecords = sqliteTable("attendance_records", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  date: text("date").notNull(), // YYYY-MM-DD
  shiftId: text("shift_id").references(() => shifts.id),
  checkInTimeUtc: text("check_in_time_utc"), // ISO 8601 UTC
  checkOutTimeUtc: text("check_out_time_utc"), // ISO 8601 UTC
  totalWorkMinutes: integer("total_work_minutes").notNull().default(0),
  status: text("status").notNull().default("PRESENT"), // PRESENT, ABSENT, LATE, HALF_DAY, ON_LEAVE
  lateMinutes: integer("late_minutes").notNull().default(0),
  earlyExitMinutes: integer("early_exit_minutes").notNull().default(0),
  notes: text("notes"),
  source: text("source").notNull().default("WEB"), // WEB, BIOMETRIC, MANUAL_ADJUSTMENT
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 7g. Attendance Events Log (Chronological check-in/out raw events)
export const attendanceEvents = sqliteTable("attendance_events", {
  id: text("id").primaryKey(),
  attendanceRecordId: text("attendance_record_id")
    .notNull()
    .references(() => attendanceRecords.id),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  eventType: text("event_type").notNull(), // CHECK_IN, CHECK_OUT
  timestampUtc: text("timestamp_utc").notNull(),
  source: text("source").notNull().default("WEB"),
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info"),
  createdAt: integer("created_at").notNull(),
});

// 7h. Attendance Correction Requests
export const attendanceCorrectionRequests = sqliteTable("attendance_correction_requests", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  attendanceRecordId: text("attendance_record_id").references(() => attendanceRecords.id),
  requestedDate: text("requested_date").notNull(), // YYYY-MM-DD
  requestedCheckInUtc: text("requested_check_in_utc").notNull(),
  requestedCheckOutUtc: text("requested_check_out_utc").notNull(),
  conflictField: text("conflict_field"), // IN_TIME | OUT_TIME
  currentValue: text("current_value"),
  requestedValue: text("requested_value"),
  proofLink: text("proof_link"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("PENDING"), // PENDING, APPROVED, REJECTED
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  reviewedAt: integer("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: integer("created_at").notNull(),
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

// 14. User Credentials (Direct Email/Password Authentication with Bcrypt)
export const userCredentials = sqliteTable("user_credentials", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  passwordHash: text("password_hash").notNull(),
  passwordUpdatedAt: integer("password_updated_at").notNull(),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: integer("locked_until"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 15. OTP Challenges (Two-Factor Verification Engine)
export const otpChallenges = sqliteTable("otp_challenges", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  challengeToken: text("challenge_token").notNull().unique(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  isUsed: integer("is_used").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

// 16. Password Reset Tokens (Self-Service & Admin Password Recovery)
export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  isUsed: integer("is_used").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});



