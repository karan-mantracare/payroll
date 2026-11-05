# MantraCare HRMS & Payroll — System Architecture

> **Document Version:** 1.0.0  
> **Target Platform:** MantraCare Programs / Minis  
> **Base Path:** `/payrol`  
> **Admin Route:** `/payrol/admin`  
> **Employee Route:** `/payrol/dash`

---

## 1. High-Level Architecture Overview

The MantraCare HRMS & Payroll system is designed as a unified, enterprise-grade, multi-portal web application embedded within the MantraCare Programs ecosystem. It serves two distinct audiences:
1. **Admin Portal (`/payrol/admin`)**: Operations and administrative tools across 12 core HRMS modules.
2. **Employee Portal (`/payrol/dash`)**: Self-service and team management tools across 11 modules.

```
                              [ MantraCare Ecosystem ]
                                         │
                   https://programs.mantracare.com/payrol
                                         │
                        [ Next.js Reverse Proxy Engine ]
                                (basePath: /payrol)
                                         │
        ┌────────────────────────────────┴────────────────────────────────┐
        │                                                                 │
  /payrol/admin/*                                                   /payrol/dash/*
┌──────────────────────────────┐                   ┌──────────────────────────────┐
│       ADMIN PORTAL           │                   │       EMPLOYEE PORTAL        │
│  - Dashboard                 │                   │  - My Dashboard              │
│  - Employee Management       │                   │  - My Profile                │
│  - Employee Lifecycle        │                   │  - My Attendance             │
│  - Attendance Management     │                   │  - My Shifts                 │
│  - Shift Management          │                   │  - My Leaves                 │
│  - Leave & Holiday           │                   │  - My Payroll                │
│  - Training Management       │                   │  - My Onboarding & JML       │
│  - Payroll Management        │                   │  - My Training               │
│  - Approvals & Requests      │                   │  - My Requests               │
│  - Reports & Analytics       │                   │  - My Team (Permission-gated)│
│  - Organization Settings     │                   │  - Team Approvals (Gated)    │
│  - Access & Administration   │                   └──────────────┬───────────────┘
└──────────────┬───────────────┘                                  │
               │                                                  │
               └───────────────────────┬──────────────────────────┘
                                       │
                      [ Unified Core Security Layer ]
                      ├── Programs Server-Side Handshake
                      ├── Cryptographic HttpOnly Session
                      ├── Permission Registry (6 Roles + Custom)
                      ├── Data-Scope Engine (SELF → ORG)
                      ├── Sensitive Field Redaction Engine
                      └── Tamper-Evident SHA-256 Audit Log
                                       │
                         [ Data Access Layer (DAL) ]
                                       │
                           [ Turso / libSQL DB ]
```

---

## 2. Monorepo & Directory Structure

```
Payroll/
├── docs/                          # Architectural and operational documentation
│   ├── ARCHITECTURE.md
│   ├── PROGRAMS_INTEGRATION.md
│   ├── AUTHENTICATION.md
│   ├── PERMISSIONS.md
│   ├── DATABASE.md
│   ├── DEPLOYMENT.md
│   └── DEPLOYMENT_CHECKLIST.md
├── src/
│   ├── app/
│   │   ├── admin/                 # 12 Admin portal route shells
│   │   │   ├── layout.tsx         # Admin layout with sidebar & portal switch
│   │   │   ├── page.tsx           # Module 1: Dashboard
│   │   │   ├── employees/         # Module 2: Employee Management
│   │   │   ├── lifecycle/         # Module 3: Employee Lifecycle
│   │   │   ├── attendance/        # Module 4: Attendance Management
│   │   │   ├── shifts/            # Module 5: Shift Management
│   │   │   ├── leaves/            # Module 6: Leave & Holiday Management
│   │   │   ├── training/          # Module 7: Training Management
│   │   │   ├── payroll/           # Module 8: Payroll Management
│   │   │   ├── approvals/         # Module 9: Approvals & Requests
│   │   │   ├── reports/           # Module 10: Reports & Analytics
│   │   │   ├── settings/          # Module 11: Organization Settings
│   │   │   └── access/            # Module 12: Access & Administration
│   │   ├── dash/                  # 11 Employee portal route shells
│   │   │   ├── layout.tsx         # Employee layout with navigation
│   │   │   ├── page.tsx           # Module 1: My Dashboard
│   │   │   ├── profile/           # Module 2: My Profile
│   │   │   ├── attendance/        # Module 3: My Attendance
│   │   │   ├── shifts/            # Module 4: My Shifts
│   │   │   ├── leaves/            # Module 5: My Leaves
│   │   │   ├── payroll/           # Module 6: My Payroll
│   │   │   ├── onboarding/        # Module 7: My Onboarding & JML
│   │   │   ├── training/          # Module 8: My Training
│   │   │   ├── requests/          # Module 9: My Requests
│   │   │   ├── team/              # Module 10: My Team (Team Manager/HR)
│   │   │   └── approvals/         # Module 11: Team Approvals (Manager/HR)
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── handshake/     # Server-to-server token validation
│   │   │   │   ├── me/            # Identity, roles, and combined permissions
│   │   │   │   └── logout/        # Session revocation
│   │   │   ├── employees/         # Scoped employee data endpoints
│   │   │   └── health/            # Container health check (HTTP 200)
│   │   ├── layout.tsx             # Root layout with blocking AuthGate
│   │   └── page.tsx               # Root redirector based on permissions
│   ├── components/                # Shared UI library (Sidebar, Navbar, Switcher, Cards)
│   ├── lib/
│   │   ├── auth/                  # Handshake protocol, session tokens, replay store
│   │   ├── permissions/           # Role definitions, permission registry, evaluator
│   │   ├── scope/                 # Data scope resolver (SELF, TEAM, DEPT, ORG)
│   │   ├── sensitive/             # Field-level permission filtering and redaction
│   │   ├── audit/                 # Append-only SHA-256 hash-chain audit log
│   │   └── db/                    # Turso libSQL client, Drizzle schema, seed data
│   └── middleware.ts              # Route-level authentication and permission gate
├── Dockerfile                     # Multi-stage production container (Node 22 LTS)
├── next.config.js                 # Standalone output with basePath: '/payrol'
├── drizzle.config.ts              # Drizzle ORM configuration for Turso
└── package.json
```

---

## 3. Core Architectural Tenets

### 3.1 Explicit Portal Permissions
Rather than hardcoding checks on role names (e.g. `if (role === 'admin')`), entry into the portals is governed by fine-grained permissions:
* `portal.admin.access`: Required to access `/payrol/admin/*`.
* `portal.employee.access`: Required to access `/payrol/dash/*`.
* **Super Admin Override**: Users holding the `SUPER_ADMIN` role have absolute bypass access to all portals, modules, and data scopes.

### 3.2 Multi-Role Permission Combination
A user may hold multiple roles simultaneously (e.g., `EMPLOYEE` + `TEAM_MANAGER` + `ADMIN`).
The system evaluates permissions by calculating the **union of all allowed permissions** across active roles, while expanding the user's data scope to the **widest permissible boundary** for each operation.

### 3.3 Strict Server-Side Boundaries
No authorization or data filtering decision relies on client state. Browser `sessionStorage` and client-passed user identifiers are treated as untrusted inputs. All queries pass through server-side authorization filters.

### 3.4 Sensitive Data Protection
Payroll, bank, tax, and government identity fields are classified as confidential. Access to these fields requires dedicated permissions (`sensitive.salary.read`, `sensitive.bank.read`, etc.). Unprivileged callers receive masked values (e.g., `••••••••`).

### 3.5 Tamper-Evident Audit Logging
Audit records form a cryptographic SHA-256 hash chain: `hash_i = SHA-256(hash_{i-1} + record_payload)`. Any attempt to alter, delete, or inject an audit record invalidates the chain.
