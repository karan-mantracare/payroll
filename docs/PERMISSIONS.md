# MantraCare HRMS & Payroll — Permission Registry & RBAC Engine

> **Document Version:** 1.0.0  
> **Core Concepts:** 6 Default Roles, Multi-Role Aggregation, 8 Data Scopes, Sensitive Field Redaction

---

## 1. The Six Default Roles

Every user in the system is assigned one or more roles. Roles map to granular permissions and default data scopes.

| Role Key | Name | Default Portal Access | Default Data Scope | Description |
| :--- | :--- | :--- | :--- | :--- |
| `SUPER_ADMIN` | Super Administrator | Admin + Employee | `ORGANIZATION` (Bypass) | Absolute system access. Can configure organization settings, roles, permissions, view tamper-evident audit logs, and access all records. |
| `ADMIN` | Administrator | Admin + Employee | `ORGANIZATION` | Full administrative control over HR operations, employees, attendance, leaves, and payroll runs. Configurable by Super Admin. |
| `HR_MANAGER` | HR Manager | Admin + Employee | `ORGANIZATION` / `DEPARTMENT` | Manages department-wide and organization-wide HR workflows: approvals, leave policies, shift scheduling, and employee lifecycle. |
| `HR_EXECUTIVE` | HR Executive | Admin + Employee | `DEPARTMENT` | Operational HR personnel: manages employee records, daily attendance tracking, leave requests, and training assignments. |
| `TEAM_MANAGER` | Team Manager | Employee (Admin if granted) | `DIRECT_REPORTS` / `TEAM` | Manages direct reports: approves team leaves, assigns team shifts, views team performance, and manages team requests. Can enter Admin portal only when granted `portal.admin.access`. |
| `EMPLOYEE` | Employee | Employee | `SELF` | Self-service access to own profile, attendance, shifts, leave balances, requests, and payslips. |

---

## 2. Explicit Portal Access Permissions

Portal navigation is decoupled from role names:
* `portal.admin.access`: Controls whether the user is permitted to load and navigate `/payrol/admin/*`.
* `portal.employee.access`: Controls whether the user is permitted to load and navigate `/payrol/dash/*`.

When a user has both permissions (e.g. an Admin who is also an Employee), the UI renders the **Portal Switcher** in the header navigation, enabling instant switching without re-authenticating.

---

## 3. Multi-Role Permission Combination Engine

A user may hold multiple roles simultaneously (e.g. `EMPLOYEE` + `TEAM_MANAGER` + `ADMIN`).

### Aggregation Rules:
1. **Permission Union**: The effective permissions set is the union of all permissions granted across all active roles:
   $$\text{Effective Permissions} = \bigcup_{r \in \text{Roles}} \text{Permissions}(r)$$
2. **Scope Widening**: For any resource, the user receives the **widest permissible data scope** among their active roles:
   $$\text{SELF} < \text{DIRECT\_REPORTS} < \text{TEAM} < \text{DEPARTMENT} < \text{LOCATION} < \text{ORGANIZATION}$$
   *Example:* If a user has `EMPLOYEE` (scope: `SELF`) and `TEAM_MANAGER` (scope: `DIRECT_REPORTS`), their effective scope for leave approvals is `DIRECT_REPORTS`.
3. **Super Admin Precedence**: If a user holds `SUPER_ADMIN`, all permission checks return `true` and the data scope is set to `ORGANIZATION` with safety bypasses enabled.

---

## 4. The 8 Supported Data Scopes

| Data Scope | Evaluation Rule in Database Queries |
| :--- | :--- |
| `SELF` | `record.employee_id == session.employee_id` |
| `DIRECT_REPORTS` | `record.manager_id == session.employee_id` |
| `REPORTING_HIERARCHY` | `record.employee_id IN (all subordinates recursively under session.employee_id)` |
| `TEAM` | `record.team_id IN (session.managed_teams)` |
| `DEPARTMENT` | `record.department_id IN (session.accessible_departments)` |
| `LOCATION` | `record.location_id IN (session.accessible_locations)` |
| `ORGANIZATION` | `record.organization_id == session.organization_id` (all employees) |
| `CUSTOM` | Filter evaluated via user's custom scope JSON rule (e.g. specific employee ID list) |

---

## 5. Sensitive Field-Level Permissions

Sensitive fields are never sent in plain text over the API unless the user possesses the matching field-level permission:

| Sensitive Field | Required Permission | Redacted Value (Fallback) |
| :--- | :--- | :--- |
| `basic_salary`, `gross_salary`, `net_salary` | `sensitive.salary.read` | `••••••••` |
| `bank_account_number`, `bank_ifsc` | `sensitive.bank.read` | `••••••••` (or masked `•••• 4321`) |
| `tax_identifier` (PAN, SSN, Tax ID) | `sensitive.tax.read` | `••••••••` |
| `identity_document_url`, `id_number` | `sensitive.identity.read` | `[RESTRICTED]` |

The API response serializer intercepts and sanitizes payloads automatically before sending JSON to the client.

---

## 6. Permission Registry Catalog (Admin & Employee Modules)

### Admin Modules (12 Modules):
1. `admin.dashboard.view`
2. `admin.employees.view`, `admin.employees.create`, `admin.employees.edit`, `admin.employees.delete`
3. `admin.lifecycle.view`, `admin.lifecycle.manage`
4. `admin.attendance.view`, `admin.attendance.manage`
5. `admin.shifts.view`, `admin.shifts.manage`
6. `admin.leaves.view`, `admin.leaves.manage`
7. `admin.training.view`, `admin.training.manage`
8. `admin.payroll.view`, `admin.payroll.run`, `admin.payroll.lock`
9. `admin.approvals.view`, `admin.approvals.decide`
10. `admin.reports.view`, `admin.reports.export`
11. `admin.settings.view`, `admin.settings.manage`
12. `admin.access.view`, `admin.access.manage`

### Employee Modules (11 Modules):
1. `dash.dashboard.view`
2. `dash.profile.view`, `dash.profile.edit_contact`
3. `dash.attendance.view`, `dash.attendance.clock_in`
4. `dash.shifts.view`, `dash.shifts.request_swap`
5. `dash.leaves.view`, `dash.leaves.apply`
6. `dash.payroll.view_own_payslips`
7. `dash.onboarding.view`, `dash.onboarding.submit_tasks`
8. `dash.training.view`, `dash.training.complete_courses`
9. `dash.requests.view`, `dash.requests.submit`
10. `dash.team.view` *(Requires Team Manager or HR)*
11. `dash.team_approvals.manage` *(Requires Team Manager or HR)*
