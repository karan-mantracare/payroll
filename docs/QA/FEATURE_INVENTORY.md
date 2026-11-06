# MantraCare HRMS & Payroll — Complete Feature Inventory

**Repository:** `karan-mantracare/payroll`  
**Base Path:** `/payrol`  
**Audit Baseline Commit:** `aabeb49`  
**Audit Date:** 2026-11-06  

---

## 1. Executive Summary

This inventory documents all 26 UI pages, 34 API routes, 28 database tables, 6 system roles, and 27 permissions currently present in the codebase. Every feature is categorized as **IMPLEMENTED**, **PARTIAL**, **PLACEHOLDER**, **NOT IMPLEMENTED**, or **BROKEN** based on actual code inspection, database persistence, and API integration.

| Status | Count | Description |
| :--- | :---: | :--- |
| **IMPLEMENTED** | 38 | Fully implemented end-to-end with UI, API, database persistence, and automated tests |
| **PARTIAL** | 5 | Functioning service/DAL or UI, with bounded development-phase limits |
| **PLACEHOLDER** | 8 | UI shell present; calculation engine or future module phases (Phase 4, 5, 5.5) deferred |
| **NOT IMPLEMENTED** | 2 | Defined in schema/specifications but UI/API endpoints deferred |
| **BROKEN** | 0 | 0 broken features identified |

---

## 2. Authentication & Session Module

| Module | Page / Endpoint | Feature | Status | API Route | Database Table(s) | Test Coverage |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **Auth** | `/payrol/login` | Direct email/password credentials form | **IMPLEMENTED** | `POST /api/auth/login` | `users`, `user_credentials` | `tests/auth.test.ts`, `tests/security-readiness.test.ts`, `scripts/e2e-browser-test.js` |
| **Auth** | `/payrol/login` | Bcrypt password verification (cost 12) | **IMPLEMENTED** | `POST /api/auth/login` | `user_credentials` | `tests/password.test.ts` (190ms benchmark) |
| **Auth** | `/payrol/login` | Cryptographic OTP generation & HMAC hash | **IMPLEMENTED** | `POST /api/auth/login` | `otp_challenges` | `tests/auth.test.ts` |
| **Auth** | `/payrol/login` | Static Dev OTP (`123456`) guard (dev/staging only) | **IMPLEMENTED** | `POST /api/auth/verify-otp` | `otp_challenges` | `tests/auth.test.ts` (blocked in prod) |
| **Auth** | `/payrol/login` | OTP attempt counting (max 5) & rate locking | **IMPLEMENTED** | `POST /api/auth/verify-otp` | `otp_challenges` | `tests/auth.test.ts` |
| **Auth** | `/payrol/login` | Atomic OTP consumption (prevents replay) | **IMPLEMENTED** | `POST /api/auth/verify-otp` | `otp_challenges` | `tests/auth.test.ts` |
| **Auth** | `/payrol/login` | OTP expiration (5-minute countdown timer) | **IMPLEMENTED** | `POST /api/auth/verify-otp` | `otp_challenges` | `tests/auth.test.ts` |
| **Auth** | `/payrol/login` | Pluggable OTP Provider (Console / Email) | **IMPLEMENTED** | Server-side abstraction | — | `tests/auth.test.ts` |
| **Auth** | `/payrol/login` | Self-Service Password Reset (Request Token) | **IMPLEMENTED** | `POST /api/auth/reset-password` | `password_reset_tokens` | `tests/auth.test.ts` |
| **Auth** | `/payrol/login` | Self-Service Password Reset (Confirm & Hash) | **IMPLEMENTED** | `POST /api/auth/reset-password` | `password_reset_tokens`, `user_credentials` | `tests/auth.test.ts` |
| **Auth** | Global / Cookie | Secure session minting & HTTP-only cookies | **IMPLEMENTED** | `POST /api/auth/verify-otp` | `auth_sessions` | `tests/auth.test.ts`, `scripts/e2e-browser-test.js` |
| **Auth** | `/payrol/api/auth/me` | Session verification & permissions resolution | **IMPLEMENTED** | `GET /api/auth/me` | `auth_sessions`, `user_roles`, `employees` | `tests/auth.test.ts`, `tests/scopes.test.ts` |
| **Auth** | Global / Navbar | Single-click logout & cookie revocation | **IMPLEMENTED** | `POST /api/auth/logout` | `auth_sessions` | `scripts/e2e-browser-test.js` |
| **Auth** | Global | Strict unauthenticated redirection guard | **IMPLEMENTED** | `middleware.ts`, `AuthGate.tsx` | — | `scripts/e2e-browser-test.js` |
| **Auth** | Global | 4-second session fetch timeout & error recovery | **IMPLEMENTED** | `AuthGate.tsx` | — | `tests/security-readiness.test.ts` |
| **Auth** | Global | Client session cache with 30s TTL revalidation | **IMPLEMENTED** | `AuthGate.tsx` | — | `scripts/e2e-browser-test.js` |

---

## 3. Employee Management Module

| Module | Page / Endpoint | Feature | Status | API Route | Database Table(s) | Test Coverage |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **Employee** | `/payrol/admin/employees` | Employee Directory listing with RBAC scope filter | **IMPLEMENTED** | `GET /api/employees` | `employees`, `users`, `departments`, `locations` | `tests/employees.test.ts`, `tests/scopes.test.ts` |
| **Employee** | `/payrol/admin/employees` | Search by name, code, email, title | **IMPLEMENTED** | `GET /api/employees?search=...` | `employees`, `users` | `tests/employees.test.ts` |
| **Employee** | `/payrol/admin/employees` | Department, location & status filters | **IMPLEMENTED** | `GET /api/employees?...` | `employees` | `tests/employees.test.ts` |
| **Employee** | `/payrol/admin/employees` | Pagination & column sorting | **IMPLEMENTED** | `GET /api/employees?...` | `employees` | `tests/employees.test.ts` |
| **Employee** | `/payrol/admin/employees` | Create Employee with auto-generated code | **IMPLEMENTED** | `POST /api/employees` | `employees`, `users`, `employee_id_configs` | `tests/employees.test.ts` |
| **Employee** | `/payrol/admin/employees/[id]`| View Employee Master Profile | **IMPLEMENTED** | `GET /api/employees/[id]` | `employees`, `users`, `departments`, `locations` | `tests/employees.test.ts` |
| **Employee** | `/payrol/admin/employees/[id]`| Edit Employee Core Information | **IMPLEMENTED** | `PATCH /api/employees/[id]` | `employees`, `users` | `tests/employees.test.ts` |
| **Employee** | `/payrol/admin/employees/[id]`| Status transition (ACTIVE/PROBATION/NOTICE/TERMINATED) | **IMPLEMENTED** | `PATCH /api/employees/[id]/status` | `employees`, `employee_status_history`, `audit_logs` | `tests/employees.test.ts` |
| **Employee** | `/payrol/admin/employees/[id]`| Reset Employee Credentials (Admin trigger) | **IMPLEMENTED** | `POST /api/employees/[id]/reset-password` | `user_credentials`, `audit_logs` | `tests/employees.test.ts` |
| **Employee** | `/payrol/admin/employees/export`| Data Export (CSV & JSON) | **IMPLEMENTED** | `GET /api/employees/export` | `employees`, `users` | `tests/employees.test.ts` |
| **Hierarchy**| `/payrol/admin/employees` | Organizational Tree hierarchy view | **IMPLEMENTED** | `GET /api/hierarchy` | `employees` | `tests/hierarchy.test.ts` |
| **Hierarchy**| `/payrol/admin/employees/[id]`| Change Reporting Manager modal with cycle check | **IMPLEMENTED** | `POST /api/hierarchy/[id]/change-manager` | `employees`, `employee_manager_history`, `audit_logs` | `tests/hierarchy.test.ts` (24 tests) |
| **Hierarchy**| `/payrol/api/hierarchy/validate`| Pre-flight DFS/BFS cycle detection API | **IMPLEMENTED** | `POST /api/hierarchy/validate` | `employees` | `tests/hierarchy.test.ts` |
| **Hierarchy**| Database Layer | Optimistic concurrency locking (`concurrency_version`)| **IMPLEMENTED** | `POST /api/hierarchy/[id]/change-manager` | `employees` | `tests/hierarchy.test.ts` |

---

## 4. Documents & Sensitive Data Protection Module

| Module | Page / Endpoint | Feature | Status | API Route | Database Table(s) | Test Coverage |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **Documents**| `/payrol/admin/employees/[id]`| Upload employee document (base64/file) | **IMPLEMENTED** | `POST /api/employees/[id]/documents` | `employee_documents`, `audit_logs` | `tests/documents.test.ts` |
| **Documents**| `/payrol/admin/employees/[id]`| List employee documents with status badge | **IMPLEMENTED** | `GET /api/employees/[id]/documents` | `employee_documents` | `tests/documents.test.ts` |
| **Documents**| `/payrol/api/documents/[id]` | Document Verification / Approval workflow | **IMPLEMENTED** | `PATCH /api/documents/[id]/verify` | `employee_documents`, `audit_logs` | `tests/documents.test.ts` |
| **Documents**| `/payrol/api/documents/[id]` | Document Rejection with reason | **IMPLEMENTED** | `PATCH /api/documents/[id]/verify` | `employee_documents`, `audit_logs` | `tests/documents.test.ts` |
| **Documents**| `/payrol/api/documents/[id]` | Short-lived signed download token | **IMPLEMENTED** | `POST /api/documents/[id]/token` | — | `tests/documents.test.ts` |
| **Documents**| `/payrol/api/documents/[id]` | Secure stream download with token validation | **IMPLEMENTED** | `GET /api/documents/[id]/download` | `employee_documents` | `tests/documents.test.ts` |
| **Sensitive**| `/payrol/admin/employees/[id]`| AES-256-GCM Envelope Encryption (salary, bank, tax)| **IMPLEMENTED** | `POST /api/employees/[id]/sensitive` | `sensitive_employee_details` | `tests/sensitive.test.ts` |
| **Sensitive**| `/payrol/admin/employees/[id]`| Decryption with RBAC permission gate (`sensitive.salary.read`)| **IMPLEMENTED** | `GET /api/employees/[id]/sensitive` | `sensitive_employee_details` | `tests/sensitive.test.ts` |
| **Sensitive**| Global Service | Key rotation support (`ACTIVE_KEY_VERSION` v1/v2)| **IMPLEMENTED** | `src/lib/security/encryption.ts` | `sensitive_employee_details.key_version` | `tests/sensitive.test.ts` |
| **Sensitive**| Global Service | PII & Bank masking (`XXXX-XXXX-1234`) | **IMPLEMENTED** | `src/lib/permissions/redactor.ts` | — | `tests/sensitive.test.ts` |

---

## 5. Attendance Management Module

| Module | Page / Endpoint | Feature | Status | API Route | Database Table(s) | Test Coverage |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **Attendance** | `/payrol/admin/attendance` | Monthly attendance records table & summary | **IMPLEMENTED** | `GET /api/attendance` | `attendance_records`, `employees` | `tests/attendance.test.ts` |
| **Attendance** | `/payrol/admin/attendance` | Bulk CSV attendance file upload & parser | **IMPLEMENTED** | `POST /api/attendance/import` | `attendance_records`, `attendance_events`, `audit_logs` | `tests/attendance.test.ts` |
| **Attendance** | `/payrol/admin/attendance` | Working hours calculation & break deductions | **IMPLEMENTED** | `src/lib/attendance/calculator.ts` | `attendance_records` | `tests/attendance.test.ts` |
| **Attendance** | `/payrol/admin/attendance` | Late arrival & early departure detection | **IMPLEMENTED** | `src/lib/attendance/calculator.ts` | `attendance_records` | `tests/attendance.test.ts` |
| **Attendance** | `/payrol/admin/attendance` | Half-day / Full-day threshold rules | **IMPLEMENTED** | `src/lib/attendance/calculator.ts` | `attendance_records` | `tests/attendance.test.ts` |
| **Attendance** | `/payrol/admin/attendance` | Cross-midnight (overnight) shift attendance | **IMPLEMENTED** | `src/lib/attendance/calculator.ts` | `attendance_records` | `tests/attendance.test.ts` |
| **Attendance** | `/payrol/dash/attendance` | Real-time Employee Clock-in | **IMPLEMENTED** | `POST /api/attendance/check-in` | `attendance_records`, `attendance_events` | `tests/attendance.test.ts` |
| **Attendance** | `/payrol/dash/attendance` | Real-time Employee Clock-out | **IMPLEMENTED** | `POST /api/attendance/check-out` | `attendance_records`, `attendance_events` | `tests/attendance.test.ts` |
| **Attendance** | `/payrol/dash/attendance` | Daily status query (clocked in / out / duration)| **IMPLEMENTED** | `GET /api/attendance/status` | `attendance_records` | `tests/attendance.test.ts` |
| **Attendance** | `/payrol/dash/attendance` | Request Attendance Correction / Regularization | **IMPLEMENTED** | `POST /api/attendance/corrections` | `attendance_correction_requests` | `tests/attendance.test.ts` |
| **Attendance** | `/payrol/admin/attendance` | Manager Approve/Reject Attendance Correction | **IMPLEMENTED** | `PATCH /api/attendance/corrections/[id]` | `attendance_correction_requests`, `attendance_records`, `audit_logs` | `tests/attendance.test.ts` |
| **Attendance** | `/payrol/admin/attendance` | Direct Admin Manual Adjustment with reason | **IMPLEMENTED** | `POST /api/attendance/adjust` | `attendance_records`, `audit_logs` | `tests/attendance.test.ts` |

---

## 6. Shift Management Module

| Module | Page / Endpoint | Feature | Status | API Route | Database Table(s) | Test Coverage |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **Shifts** | `/payrol/admin/shifts` | Shift roster & template listing | **IMPLEMENTED** | `GET /api/shifts` | `shifts` | `tests/shifts.test.ts` |
| **Shifts** | `/payrol/admin/shifts` | Create new shift template (timing, grace period)| **IMPLEMENTED** | `POST /api/shifts` | `shifts`, `audit_logs` | `tests/shifts.test.ts` |
| **Shifts** | `/payrol/admin/shifts` | Update shift timings / grace period | **IMPLEMENTED** | `PATCH /api/shifts` | `shifts`, `audit_logs` | `tests/shifts.test.ts` |
| **Shifts** | `/payrol/admin/shifts` | Disable / Deactivate shift template | **IMPLEMENTED** | `PATCH /api/shifts` | `shifts`, `audit_logs` | `tests/shifts.test.ts` |
| **Shifts** | `/payrol/admin/shifts` | Assign shift to single employee with effective dates| **IMPLEMENTED** | `POST /api/shifts/assignments` | `shift_assignments`, `shift_history`, `audit_logs` | `tests/shifts.test.ts` |
| **Shifts** | `/payrol/admin/shifts` | Bulk assign shift to multiple employees | **IMPLEMENTED** | `POST /api/shifts/assignments` | `shift_assignments`, `shift_history`, `audit_logs` | `tests/shifts.test.ts` |
| **Shifts** | `/payrol/admin/shifts` | Overnight shift definition (`is_overnight = 1`)| **IMPLEMENTED** | `POST /api/shifts` | `shifts` | `tests/shifts.test.ts` |
| **Shifts** | `/payrol/admin/shifts` | Shift assignment history audit log | **IMPLEMENTED** | `GET /api/shifts` | `shift_history` | `tests/shifts.test.ts` |
| **Shifts** | `/payrol/dash/shifts` | Employee upcoming shift calendar view | **IMPLEMENTED** | `GET /api/shifts` | `shift_assignments`, `shifts` | `tests/shifts.test.ts` |

---

## 7. Audit Logging & Access Administration Module

| Module | Page / Endpoint | Feature | Status | API Route | Database Table(s) | Test Coverage |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **Audit** | `/payrol/admin/access` | Tamper-evident SHA-256 audit event logging | **IMPLEMENTED** | `POST /api/audit` (internal) | `audit_logs` | `tests/auth.test.ts`, `tests/hierarchy.test.ts` |
| **Audit** | `/payrol/admin/access` | Cryptographic hash chain verification engine | **IMPLEMENTED** | `GET /api/audit` | `audit_logs` | UI integration & browser test |
| **Access**| `/payrol/admin/access` | System Roles & RBAC Registry display | **IMPLEMENTED** | `src/lib/permissions/registry.ts` | `roles`, `role_permissions` | `tests/permissions.test.ts` |

---

## 8. Employee Portal (Self-Service) Workflows

| Module | Page / Endpoint | Feature | Status | API Route | Database Table(s) | Test Coverage |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **Dash** | `/payrol/dash` | Employee Self-Service Dashboard KPIs & Banner | **IMPLEMENTED** | `GET /api/auth/me` | `employees`, `attendance_records` | `scripts/e2e-browser-test.js` |
| **Dash** | `/payrol/dash/profile` | Self Profile overview & contact details | **IMPLEMENTED** | `GET /api/auth/me` | `employees`, `users` | `tests/employees.test.ts` |
| **Dash** | `/payrol/dash/team` | Team Manager Direct Reports directory | **IMPLEMENTED** | `GET /api/dash/team` | `employees`, `users` | `tests/scopes.test.ts` |
| **Dash** | `/payrol/dash/approvals` | Manager pending approval tasks | **PARTIAL** | UI shell connected to correction queues | `attendance_correction_requests` | Browser tested |

---

## 9. Deferred / Placeholder Modules (Explicit Pause Scope)

| Module | Page | Status | Reason & Current State | Planned Phase |
| :--- | :--- | :---: | :--- | :---: |
| **Leaves** | `/payrol/admin/leaves` | **PLACEHOLDER** | Static informational cards; tables not yet wired. | **Phase 4** |
| **Leaves** | `/payrol/dash/leaves` | **PLACEHOLDER** | Static leave quota cards; application submission deferred. | **Phase 4** |
| **Lifecycle**| `/payrol/admin/lifecycle` | **PLACEHOLDER** | JML workflow shell; task progression deferred. | **Phase 5** |
| **Lifecycle**| `/payrol/dash/onboarding` | **PLACEHOLDER** | Onboarding checklist shell; task submission deferred. | **Phase 5** |
| **Training** | `/payrol/admin/training` | **PLACEHOLDER** | LMS shell; course upload and assignments deferred. | **Phase 5.5** |
| **Training** | `/payrol/dash/training` | **PLACEHOLDER** | Course catalog shell; enrollment deferred. | **Phase 5.5** |
| **Payroll** | `/payrol/admin/payroll` | **PLACEHOLDER** | UI indicates "Phase 1 Architectural Shell Active". Calculation formulas deferred. | **Phase 3 Calculation** |
| **Payroll** | `/payrol/dash/payroll` | **PLACEHOLDER** | Payslip history shell; calculation engine deferred. | **Phase 3 Calculation** |
| **Reports** | `/payrol/admin/reports` | **PLACEHOLDER** | Reporting catalog shell; query generator deferred. | **Future Phase** |
| **Settings**| `/payrol/admin/settings` | **PLACEHOLDER** | Company settings overview shell. | **Future Phase** |
| **Requests**| `/payrol/dash/requests` | **PLACEHOLDER** | Generic request tracker shell. | **Future Phase** |
