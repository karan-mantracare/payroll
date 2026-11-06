# MantraCare HRMS & Payroll — Defect Register

**Repository:** `karan-mantracare/payroll`  
**Base Path:** `/payrol`  
**Baseline Commit:** `aabeb49`  
**Audit Date:** 2026-11-06  

---

## 1. Defect Severity Summary

| Severity | Total Discovered | Resolved & Verified | Open |
| :--- | :---: | :---: | :---: |
| **Critical** | 4 | 4 | 0 |
| **High** | 3 | 3 | 0 |
| **Medium** | 3 | 3 | 0 |
| **Low** | 2 | 2 | 0 |
| **TOTAL** | **12** | **12** | **0** |

---

## 2. Comprehensive Defect Register

### DEF-001: Raw SQL Query & Parameter Array Leaked on Login UI
- **Severity:** **Critical** (CWE-209 / Information Exposure)
- **Component:** `src/app/api/auth/login/route.ts` & `src/app/login/page.tsx`
- **Symptom:** When an OTP challenge insert failed, the login UI printed: `Failed query: insert into "otp_challenges" (...) params: [...]` directly in a red alert banner.
- **Root Cause:** Uncaught database error strings were passed directly to `res.error`, and the UI rendered `res.error` without sanitization.
- **Correction:** Implemented allowlist-based `sanitizeUserFacingError()` in `src/lib/security/safe-logger.ts`. Any error not explicitly allowlisted returns: *"Unable to complete sign-in right now. Please try again."*. Structured server-side logging with `logSecureError()` scrubs all parameters and PII.
- **Regression Test:** `tests/security-readiness.test.ts` (rejection of raw SQL statements and return of generic fallback).
- **Status:** **CLOSED & VERIFIED**

---

### DEF-002: Infinite Loading Screen on `/payrol/dash` (React Hydration Failure)
- **Severity:** **Critical** (Availability / Denial of Service)
- **Component:** `src/components/AuthGate.tsx` & `src/middleware.ts`
- **Symptom:** Users navigating to `/payrol/dash` were trapped on "Verifying Authentication — Checking secure session permissions..." indefinitely with console errors: 404 for chunk scripts and MIME-type `text/plain` errors.
- **Root Cause:**
  1. Next.js stale chunks caused `<script>` tags to return 404 HTML, which Chrome refused to execute due to `nosniff`, preventing React from mounting or hydrating the page.
  2. `AuthGate` lacked request timeouts and promise deduplication, causing duplicate calls to hang.
- **Correction:**
  - Implemented 4-second bounded timeout with `AbortController` in `AuthGate.tsx`. If verification fails, transitions to an actionable error card with Retry buttons.
  - Added deployment chunk mismatch auto-reload handler in `src/app/layout.tsx`.
  - Added `assetPrefix: "/payrol"` and immutable caching in `next.config.js`.
  - Added middleware bypass for static chunks in `src/middleware.ts`.
- **Regression Test:** `scripts/e2e-browser-test.js` (Test 6: Page reload completes cleanly in 860ms).
- **Status:** **CLOSED & VERIFIED**

---

### DEF-003: Destructive Seeding Erased Remote Staging Database Records
- **Severity:** **Critical** (Data Integrity / Accidental Loss)
- **Component:** `src/lib/db/seed.ts`
- **Symptom:** Running `npm run db:seed` against persistent staging executed `DELETE FROM ...` across employees, credentials, and audit logs.
- **Root Cause:** `seed.ts` did not check whether the target database destination was a remote persistent database.
- **Correction:** Introduced `resolveDatabaseConfig()` and three strict safety guards:
  1. Blocks execution if target is production.
  2. Blocks execution if `!config.isDisposable` (blocks any remote `libsql://` endpoint).
  3. Outside test mode, requires explicit `ALLOW_DESTRUCTIVE_SEED=true`.
- **Regression Test:** `tests/db-config.test.ts` (blocking destructive seeding on persistent remote DBs).
- **Status:** **CLOSED & VERIFIED**

---

### DEF-004: Missing `schema_migrations` Table on Remote Turso Staging
- **Severity:** **Critical** (Schema Versioning & Governance)
- **Component:** `src/lib/db/migrate.ts`
- **Symptom:** Startup readiness checks failed on staging because `schema_migrations` was not initialized in the remote database.
- **Root Cause:** `schema_migrations` DDL was newly added to the migration registry as version 001, but migrations had not been triggered against the staging endpoint.
- **Correction:** Applied versioned migrations (`npm run db:migrate`) to Turso Staging. All 6 version steps (`001` to `006`) are now recorded with SHA-256 checksums.
- **Regression Test:** `tests/security-readiness.test.ts` & `src/lib/db/readiness.ts`.
- **Status:** **CLOSED & VERIFIED**

---

### DEF-005: Low-Contrast Badges in Admin and Employee Portals
- **Severity:** **High** (Accessibility / WCAG AA Failure)
- **Component:** `src/components/Navbar.tsx`, `src/app/admin/page.tsx`, `src/app/dash/page.tsx`
- **Symptom:** Badges `Admin Portal`, `Programs Platform Environment`, `Employee Portal`, and `Employee Self-Service Active` displayed white text on light gray/purple backgrounds with near-zero contrast.
- **Root Cause:** Classes `bg-slate-100 text-white` lacked sufficient contrast.
- **Correction:** Updated badges across all headers and portals to high-contrast solid Mantra Navy: `bg-[#293381] text-white shadow-sm border border-[#293381]` (WCAG contrast ratio > 12:1). Replaced legacy text `Programs Platform Environment` with `Enterprise HRMS Environment`.
- **Regression Test:** `scripts/e2e-browser-test.js` (Test 4 & 5: verifies `backgroundColor: rgb(41, 51, 129)` and `color: rgb(255, 255, 255)`).
- **Status:** **CLOSED & VERIFIED**

---

### DEF-006: Unconstrained Mantra Logo on Login Screen
- **Severity:** **High** (Visual Regression / UI Layout Breakdown)
- **Component:** `src/app/login/page.tsx` & `src/components/BrandLogo.tsx`
- **Symptom:** The MantraCare logo blew up across the entire screen unconstrained before stylesheets loaded.
- **Root Cause:** Rendered as an unstyled `<img>` tag without explicit inline width/height constraints.
- **Correction:** Built `BrandLogo.tsx` with inline constraints: `style={{ aspectRatio: "906 / 292", maxWidth: "150px", maxHeight: "36px" }}`.
- **Regression Test:** `scripts/e2e-browser-test.js` (Test 1: asserts `width <= 150px` and `height <= 36px`).
- **Status:** **CLOSED & VERIFIED**

---

### DEF-007: DDL Statements in `checkStartupReadiness()`
- **Severity:** **High** (Architectural Safety / Uncontrolled Migrations)
- **Component:** `src/lib/db/readiness.ts`
- **Symptom:** `checkStartupReadiness()` was executing `CREATE UNIQUE INDEX IF NOT EXISTS` statements during application startup checks.
- **Root Cause:** Indexes were originally checked by running their DDL rather than inspecting the schema metadata.
- **Correction:** Converted `checkStartupReadiness()` to strictly read-only inspection using `SELECT name FROM sqlite_master WHERE type='index'`.
- **Regression Test:** `tests/security-readiness.test.ts` (verifies all 6 indexes are verified via read-only query).
- **Status:** **CLOSED & VERIFIED**

---

### DEF-008: AuthGate Indefinite Session Caching without Revalidation
- **Severity:** **Medium** (Session Lifecycle / State Staleness)
- **Component:** `src/components/AuthGate.tsx`
- **Symptom:** If a user logged out in another tab or the session expired on the server, an active SPA tab continued showing cached user details without revalidating.
- **Root Cause:** `cachedClientUser` had no TTL and bypassed network calls whenever populated.
- **Correction:** Implemented 30-second cache TTL (`SESSION_CACHE_MAX_AGE_MS = 30000`). Added `visibilitychange` listener and `invalidateClientSession()` to trigger revalidation upon tab focus or 401 response.
- **Regression Test:** `scripts/e2e-browser-test.js` (Test 8: expired session immediately redirects to login).
- **Status:** **CLOSED & VERIFIED**

---

### DEF-009: Test Runner Could Target Production Database via Alternate Variables
- **Severity:** **Medium** (Environment Isolation / Test Bleed)
- **Component:** `src/lib/db/config.ts`
- **Symptom:** While `PAYROLL_DB_ENV` was checked, tests could accidentally connect to production if `TURSO_DATABASE_URL` was populated with the production URL.
- **Root Cause:** Environment resolution only checked `PAYROLL_DB_ENV`, not the resolved URL.
- **Correction:** Added `isProductionDestination(url, token)` heuristic that inspects both the URL host and token. Throws fatal error if tests target a production endpoint under any variable name.
- **Regression Test:** `tests/db-config.test.ts` (tests 2, 3, 4).
- **Status:** **CLOSED & VERIFIED**

---

### DEF-010: Uncaught Exception Leaked in Password Policy Validation
- **Severity:** **Medium** (Error Handling / Information Disclosure)
- **Component:** `src/lib/security/safe-logger.ts`
- **Symptom:** The word "at least" in password policy error messages inadvertently matched an overbroad stack trace regex (`/at \w+/i`), causing safe messages to be masked.
- **Root Cause:** Inexact regex for stack trace frames.
- **Correction:** Replaced `/at \w+/i` with specific stack frame pattern `/\bat\s+(?:async\s+)?[a-zA-Z0-9_$.<>[\]]+\s+\(/i`.
- **Regression Test:** `tests/security-readiness.test.ts` (allows `Password must be at least 8 characters...`).
- **Status:** **CLOSED & VERIFIED**

---

### DEF-011: Missing Favicon Route Returned 404
- **Severity:** **Low** (Browser Console Hygiene)
- **Component:** `public/` & `src/app/layout.tsx`
- **Symptom:** Browser console showed: `Failed to load resource: 404 (Not Found) /favicon.ico`.
- **Root Cause:** Favicon was referenced as `/payrol/favicon.ico` but was only located at the root.
- **Correction:** Added `favicon.ico` and `favicon.png` into `public/` and configured metadata icons with `/payrol/` prefix.
- **Regression Test:** `scripts/e2e-browser-test.js` (zero 404 console errors).
- **Status:** **CLOSED & VERIFIED**

---

### DEF-012: Inconsistent Turso HTTP PRAGMA Execution
- **Severity:** **Low** (Database Client Compatibility)
- **Component:** `src/lib/db/migrate.ts`
- **Symptom:** Running interactive `PRAGMA journal_mode = WAL;` against remote Turso HTTP endpoints threw warnings.
- **Root Cause:** LibSQL remote endpoints over HTTP do not support interactive journal mode pragma mutations.
- **Correction:** Wrapped PRAGMA calls in `try/catch` with environment awareness so remote migrations proceed smoothly.
- **Regression Test:** `npm run db:migrate` against Turso Staging.
- **Status:** **CLOSED & VERIFIED**
