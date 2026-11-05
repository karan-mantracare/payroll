# MantraCare Programs / Minis Platform Integration Analysis

> **Project:** MantraCare HRMS & Payroll Application  
> **Classification:** Confidential HR & Financial Infrastructure  
> **Production Base URL:** `https://programs.mantracare.com/payrol`  
> **Mount Paths:** `/payrol/admin` (Admin Portal) & `/payrol/dash` (Employee Portal)

---

## 1. Executive Summary & Purpose

This document details the architectural integration of the MantraCare HRMS & Payroll application into the existing MantraCare Programs / Minis ecosystem. It performs a rigorous analysis of all requirements stated in the official [Minis Workflow Documentation](https://minis-workflow.mintlify.site/), assesses their applicability to an enterprise-grade HRMS, identifies architectural and security conflicts, and establishes the production-grade implementation specifications.

---

## 2. Requirement-by-Requirement Analysis Matrix

| Minis Phase / Topic | Minis Standard Requirement | Applies to Payroll? | Payroll Implementation & Conflict Resolution |
| :--- | :--- | :--- | :--- |
| **Phase 1: Build & Scaffolding** | Next.js (App Router) + TypeScript + Tailwind CSS | **YES** | Standardized on Next.js 15 (App Router), TypeScript 5, and Tailwind CSS. Clean enterprise design system without external template watermarks. |
| **Phase 2: Subpath Hosting** | `basePath: "/your-slug"` and `assetPrefix: "/your-slug"` | **YES** | Configured with `basePath: "/payrol"` and `assetPrefix: "/payrol"`. Both portals (`/payrol/admin` and `/payrol/dash`) and API routes (`/payrol/api/*`) operate smoothly under this mount. |
| **Phase 2: Project Slug** | Single slug with underscores on platform (`payrol`) | **YES** | Registered on `minis.mantracare.com` with slug `payrol`. Container port `80`. Docker image tag `bunker.mantracare.com/lovable/payrol:1.0`. |
| **Phase 2: Docker Container** | Multi-stage Docker build, standalone output, port 80 | **YES (Overridden)** | **Conflict:** Documentation specifies Node 20. **Override:** Node 20 is not permitted per project requirements; we use active LTS **Node 22** (`node:22-alpine`) with a non-root runtime user (`nextjs:nodejs`). |
| **Phase 2: Registry & CI/CD** | Push to `bunker.mantracare.com` via GitHub Actions | **YES** | GitHub Actions workflow `.github/workflows/docker-publish.yml` authenticates via `USERNAME` and `PASSWORD` secrets and pushes amd64 images to Harbor. |
| **Phase 3: Database** | Neon PostgreSQL 18 with RLS | **NO (Overridden)** | **Mandatory Override:** Neon Postgres is replaced by **Turso (libSQL)** + **Drizzle ORM**. Centralized application-level data scope enforcement is implemented in place of Postgres RLS. |
| **Phase 3: Auth Handshake** | Client-side `sessionStorage` storing raw `user_id` | **NO (Conflict)** | **Critical Conflict:** Client-side `sessionStorage` cannot be trusted for confidential payroll records. Replaced by a server-verified hybrid handshake issuing encrypted `HttpOnly` session cookies. |
| **Phase 4: HTTPS Enforced** | Never redirect to HTTP; avoid mixed content | **YES** | Enforced across all internal URLs, redirection rules, and API endpoints. HSTS and CSP headers configured. |
| **Phase 4: Iframe Embedding** | Support embedding inside `web.mantracare.com` | **YES** | Configured via `Content-Security-Policy: frame-ancestors 'self' https://web.mantracare.com https://*.mantracare.com;`. |
| **Phase 4: WebView Support** | React Native WebView navigation and exit messaging | **YES** | Safe detection of `window.ReactNativeWebView` with validated postMessage payloads and origin verification. |
| **Phase 4: Internationalization** | Module-based offline translations via i18next | **YES** | Modular translation catalog structure (`src/modules/*/i18n/`) keyed by `?lang=xx`. Zero runtime translation API calls. |
| **Phase 4: Pathway Webhook** | `POST https://api.mantracare.com/webhook/pathway` | **NO** | Wellness pathway assignments and activity completion webhooks do not apply to core HRMS/Payroll processing. Cleanly modularized for future employee wellness benefit modules. |
| **Phase 4: Insights Webhook** | `POST /webhook/assessment/v2` | **NO** | Patient mental/physical health assessment webhooks do not apply to payroll records. |
| **Phase 4: Cloudinary Hosting** | Cloudinary for images and static assets | **OPTIONAL** | Internal HRMS assets are bundled or served from dedicated secure storage. Employee identity documents and payslips are stored server-side with signed URLs, never publicly accessible. |
| **Phase 5: Mixpanel Analytics** | Product tracking & growth loop | **CONDITIONAL** | Only high-level UI interactions (e.g. portal navigation, feature adoption) may be tracked. **STRICT EXCLUSION:** Employee salaries, bank details, tax IDs, and PII are strictly barred from analytics. |
| **Phase 6: Harbor Storage** | Harbor 5 GiB quota cleanup policy | **YES** | Managed via semantic image tags and image prune retention rules. |

---

## 3. Deep Dive: Architectural Conflicts & Mitigations

### 3.1 Nested Route Deployment (`/payrol/admin` & `/payrol/dash`)

* **Conflict:** The Minis platform routing proxy only matches top-level slugs without slashes. Attempting to register two separate Minis at `/payrol/admin` and `/payrol/dash` is unsupported by the platform.
* **Resolution (Option A):** Deploy a single unified Next.js application at `basePath: "/payrol"`. Inside Next.js App Router:
  * `/payrol/admin/*` handles the 12 Admin Portal modules.
  * `/payrol/dash/*` handles the 11 Employee Portal modules.
  * Shared middleware validates authentication and enforces portal access permissions (`portal.admin.access` vs `portal.employee.access`).

### 3.2 Authentication Handshake Security

* **Conflict:** Standard Minis documentation suggests a client-side `fetch` to `https://api.mantracare.com/user/user-info`, saving `data.user_id` in `sessionStorage`. For an HRMS and Payroll system, this would introduce critical vulnerabilities:
  1. Any platform user could spoof `sessionStorage.getItem('user_id')` or inspect browser state to impersonate another employee.
  2. Any valid MantraCare platform user would automatically pass the gate, even if they have no employment record or payroll entitlement.
  3. Tokens passed in the URL query string would remain in browser history and referrer headers.
* **Resolution (Server-Verified Handshake)**:
  1. The client intercepts `?token=<bootstrap-token>` via a blocking `AuthGate`.
  2. A server endpoint `POST /payrol/api/auth/handshake` validates the token against `https://api.mantracare.com/user/user-info` server-to-server.
  3. The server checks token expiry and records the SHA-256 hash in a `used_tokens` replay-protection table.
  4. The returned `platform_user_id` is matched against the internal HRMS `user_mappings` and `employees` database table. If unmapped or inactive, access is denied (403).
  5. Upon success, the server creates an authenticated session in Turso and sets a secure `HttpOnly`, `SameSite=Lax`, `Secure` cookie `mc_payroll_session`.
  6. The client immediately invokes `window.history.replaceState` to strip `?token=` from the browser address bar.

### 3.3 Turso (libSQL) Data-Scope Enforcement vs Postgres RLS

* **Conflict:** Neon PostgreSQL offers native Row Level Security (RLS) driven by database session variables. Turso/libSQL does not have declarative SQL RLS.
* **Resolution (Application-Level Data Scope Engine)**:
  * A centralized Data Access Layer (`withDataScope`) intercepts all database queries.
  * The engine evaluates the caller's active roles and applies filter expressions (`WHERE`) based on the caller's authorized scope: `SELF`, `DIRECT_REPORTS`, `REPORTING_HIERARCHY`, `TEAM`, `DEPARTMENT`, `LOCATION`, `ORGANIZATION`, or `CUSTOM`.
  * Automated security unit tests verify that cross-employee and cross-department queries are rejected.

---

## 4. Integration Verification Checklist

- [x] Single unified container running on port 80 at `basePath: "/payrol"`.
- [x] Both URLs (`/payrol/admin` and `/payrol/dash`) route correctly.
- [x] Programs token handshake validated server-side with replay protection.
- [x] `HttpOnly`, `Secure` cookie session persistence.
- [x] Turso libSQL integration with centralized server-side data scoping.
- [x] Explicit portal permissions (`portal.admin.access`, `portal.employee.access`).
- [x] Multi-role permission aggregation (Employee + Team Manager + Admin).
- [x] Sensitive field masking (salaries, bank details, tax IDs).
- [x] Tamper-evident SHA-256 hash-chain audit log.
- [x] Docker image built with Node 22 LTS (avoiding Node 20).
- [x] CSP frame-ancestors configured for `web.mantracare.com`.

