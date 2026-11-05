# MantraCare HRMS & Payroll — Pre-Launch Deployment Checklist

> **Baseline:** Official Minis Pre-Launch Checklist + Enterprise HRMS Security Controls

---

## 1. Minis Platform Baseline Checks

- [ ] **Next.js Base Path Alignment**: `next.config.js` specifies `basePath: "/payrol"` and matches the Minis project slug `payrol`.
- [ ] **Docker Multi-Stage Build**: Built with `node:22-alpine` LTS (Node 20 strictly prohibited), listening on port `80`.
- [ ] **Private Registry Authentication**: GitHub Secrets `USERNAME` and `PASSWORD` configured for `bunker.mantracare.com`.
- [ ] **Harbor Image Tag**: Image pushed to `bunker.mantracare.com/lovable/payrol:1.0`.
- [ ] **Minis Slug Compliance**: Project registered on `minis.mantracare.com` with exact slug `payrol` (no dashes/slashes).
- [ ] **Port 80 Configuration**: Internal container port mapped to `80`.
- [ ] **Health Check Live**: `/payrol/api/health` returns `200 OK` with JSON `{ status: "healthy", timestamp: ... }`.
- [ ] **No Mixed Content**: All asset links, font imports, and API routes load strictly over HTTPS.
- [ ] **Iframe Embedding Tested**: Verified inside `web.mantracare.com` with CSP `frame-ancestors`.
- [ ] **WebView Messaging Tested**: `window.ReactNativeWebView` detected; postMessage origin verification in place.

---

## 2. HRMS & Security Controls Checklist

- [ ] **Both Portal URLs Operational**:
  - Admin Portal loads at `/payrol/admin`
  - Employee Portal loads at `/payrol/dash`
- [ ] **Shared Authentication Handshake Verified**:
  - Handshake route `/payrol/api/auth/handshake` resolves platform token against `https://api.mantracare.com/user/user-info`.
  - Token replay is blocked via `used_tokens` SHA-256 table.
  - URL query string `?token=...` is stripped immediately from the browser address bar.
  - Session established via `HttpOnly`, `Secure`, `SameSite=Lax` cookie `mc_payroll_session`.
- [ ] **Unauthorized Platform Users Blocked**:
  - Platform users lacking an active employee record in Turso receive `403 Forbidden` ("Not Authorized for Payroll").
- [ ] **Explicit Portal Access Permissions**:
  - Non-admin users attempting to open `/payrol/admin` are redirected to `/payrol/dash`.
  - Team Managers can only access `/payrol/admin` if granted explicit `portal.admin.access`.
  - Super Admin has full unrestricted access to both portals.
- [ ] **Multi-Role Union Verified**:
  - Users with multiple roles (e.g. Employee + Team Manager + Admin) aggregate permissions correctly.
  - Data scope widens to the most permissive scope permitted by active roles.
- [ ] **Turso libSQL Security & Data Scoping**:
  - Cross-employee unauthorized reads return empty or forbidden.
  - Department and team boundaries strictly enforced server-side.
  - Turso credentials are not present in client-side JavaScript bundles.
- [ ] **Sensitive Field Redaction**:
  - Salary, bank account, and tax IDs are masked (`••••••••`) for users lacking `sensitive.*.read` permissions.
- [ ] **Tamper-Evident Audit Logging**:
  - Sensitive operations append to `audit_logs` with SHA-256 hash chaining.
  - Verification test `verifyAuditLogIntegrity()` passes without error.
- [ ] **Automated Test Suite**:
  - All unit and security tests pass via `npm run test`.

