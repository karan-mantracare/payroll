export type RoleKey =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "HR_MANAGER"
  | "HR_EXECUTIVE"
  | "TEAM_MANAGER"
  | "EMPLOYEE"
  | (string & {});

export type DataScope =
  | "SELF"
  | "DIRECT_REPORTS"
  | "REPORTING_HIERARCHY"
  | "TEAM"
  | "DEPARTMENT"
  | "LOCATION"
  | "ORGANIZATION"
  | "CUSTOM";

export const SCOPE_HIERARCHY: Record<DataScope, number> = {
  SELF: 1,
  DIRECT_REPORTS: 2,
  REPORTING_HIERARCHY: 3,
  TEAM: 4,
  DEPARTMENT: 5,
  LOCATION: 6,
  ORGANIZATION: 7,
  CUSTOM: 0, // Custom evaluated independently
};

// Explicit Portal Access Permissions
export const PORTAL_PERMISSIONS = {
  ADMIN_ACCESS: "portal.admin.access",
  EMPLOYEE_ACCESS: "portal.employee.access",
} as const;

// Sensitive Field Access Permissions
export const SENSITIVE_PERMISSIONS = {
  SALARY_READ: "sensitive.salary.read",
  SALARY_WRITE: "sensitive.salary.write",
  BANK_READ: "sensitive.bank.read",
  TAX_READ: "sensitive.tax.read",
  IDENTITY_READ: "sensitive.identity.read",
} as const;

// Admin Module Permissions (12 Modules)
export const ADMIN_MODULE_PERMISSIONS = {
  DASHBOARD_VIEW: "admin.dashboard.view",
  EMPLOYEES_VIEW: "admin.employees.view",
  EMPLOYEES_MANAGE: "admin.employees.manage",
  LIFECYCLE_VIEW: "admin.lifecycle.view",
  LIFECYCLE_MANAGE: "admin.lifecycle.manage",
  ATTENDANCE_VIEW: "admin.attendance.view",
  ATTENDANCE_MANAGE: "admin.attendance.manage",
  SHIFTS_VIEW: "admin.shifts.view",
  SHIFTS_MANAGE: "admin.shifts.manage",
  LEAVES_VIEW: "admin.leaves.view",
  LEAVES_MANAGE: "admin.leaves.manage",
  TRAINING_VIEW: "admin.training.view",
  TRAINING_MANAGE: "admin.training.manage",
  PAYROLL_VIEW: "admin.payroll.view",
  PAYROLL_MANAGE: "admin.payroll.manage",
  APPROVALS_VIEW: "admin.approvals.view",
  APPROVALS_MANAGE: "admin.approvals.manage",
  REPORTS_VIEW: "admin.reports.view",
  REPORTS_MANAGE: "admin.reports.manage",
  SETTINGS_VIEW: "admin.settings.view",
  SETTINGS_MANAGE: "admin.settings.manage",
  ACCESS_VIEW: "admin.access.view",
  ACCESS_MANAGE: "admin.access.manage",
} as const;

// Employee Module Permissions (11 Modules)
export const DASH_MODULE_PERMISSIONS = {
  DASHBOARD_VIEW: "dash.dashboard.view",
  PROFILE_VIEW: "dash.profile.view",
  PROFILE_EDIT: "dash.profile.edit",
  ATTENDANCE_VIEW: "dash.attendance.view",
  ATTENDANCE_RECORD: "dash.attendance.record",
  SHIFTS_VIEW: "dash.shifts.view",
  LEAVES_VIEW: "dash.leaves.view",
  LEAVES_APPLY: "dash.leaves.apply",
  PAYROLL_VIEW: "dash.payroll.view",
  ONBOARDING_VIEW: "dash.onboarding.view",
  TRAINING_VIEW: "dash.training.view",
  REQUESTS_VIEW: "dash.requests.view",
  REQUESTS_CREATE: "dash.requests.create",
  TEAM_VIEW: "dash.team.view", // Protected (Team Manager/HR only)
  TEAM_APPROVALS_MANAGE: "dash.team_approvals.manage", // Protected (Team Manager/HR only)
} as const;

export interface SessionContext {
  userId: string;
  employeeId?: string;
  name: string;
  email: string;
  organizationId: string;
  departmentId?: string;
  locationId?: string;
  teamId?: string;
  roles: RoleKey[];
  effectivePermissions: string[];
  widestScope: DataScope;
  managedDepartmentIds: string[];
  managedTeamIds: string[];
  directReportIds: string[];
  isSuperAdmin: boolean;
}
