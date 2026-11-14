# MantraCare HRMS & Payroll

Enterprise HRMS, Attendance, Leave, Shift, Lifecycle (JML), and Payroll suite built with Next.js 15, Drizzle ORM, and Turso (libSQL), designed to run inside the MantraCare ecosystem at `/payroll`.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, `output: "standalone"`, `basePath: "/payroll"`) + React 19 + TypeScript
- **Styling**: Tailwind CSS + Lucide Icons
- **Database**: Drizzle ORM + `@libsql/client` (local SQLite `file:local.db` for dev/test, Turso libSQL for staging/production)
- **PDF Generation**: Puppeteer + Chromium (A4 corporate-letterhead payslip export)
- **Security**: AES-256-GCM field-level encryption with versioned keys, bcrypt password hashing, 2FA OTP, HTTP-only session cookies, RBAC + organizational scope guards, tamper-evident audit logs
- **Testing**: Vitest
- **Container**: Node 22 LTS Alpine (`Dockerfile`)

---

## Core Modules

### Employee Portal (`/payroll/dash`)
- **Dashboard & Requests**: Quick overview of attendance, shifts, leaves, and request statuses
- **My Profile (`/payroll/dash/profile`)**: Personal/employment details and **Request Change** workflow
- **My Attendance (`/payroll/dash/attendance`)**: Check-in/out and attendance correction requests
- **My Shifts (`/payroll/dash/shifts`)**: Assigned shift schedule and shift change requests
- **My Leaves (`/payroll/dash/leaves`)**: Privilege, Casual, and Sick leave balances, holiday calendar, and **Apply for Leave**
- **My Payroll (`/payroll/dash/payroll`)**: Payslip modal with corporate letterhead, Print formatting, and A4 PDF download
- **Onboarding & JML (`/payroll/dash/onboarding`)**: Checklist + **Request to Move** / **Request to Leave**
- **My Training (`/payroll/dash/training`)**: Assigned training modules and assessments
- **Manager Views (`/payroll/dash/team`, `/payroll/dash/approvals`)**: Team directory and direct-report approvals

### Admin Portal (`/payroll/admin`)
- **Employee Master (`/payroll/admin/employees`)**: Directory, CSV export, encrypted financial/bank vault, document vault, and reporting hierarchy
- **Attendance & Shifts (`/payroll/admin/attendance`, `/payroll/admin/shifts`)**: Manual adjustments, bulk import, correction & shift-change approvals
- **Leaves & Holidays (`/payroll/admin/leaves`)**: Leave quota configuration, holiday calendar, and leave approval queue
- **Lifecycle & Approvals (`/payroll/admin/lifecycle`, `/payroll/admin/approvals`)**: JML transfer/exit queue and profile change review queue
- **Payroll (`/payroll/admin/payroll`)**: Payroll disbursement view and corporate-letterhead PDF payslips
- **Access & Audit (`/payroll/admin/access`, `/payroll/admin/settings`)**: Role/permission visibility and hash-chained audit logs

---

## Local Development

### Prerequisites
- **Node.js 22 LTS** and **npm**
- **OpenSSL** (for generating encryption/session secrets)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy the example file and generate a 32-byte (64-hex-char) encryption key:
```bash
cp .env.example .env.local
openssl rand -hex 32
```
Update `.env.local` with `PAYROLL_DB_ENV=development`, `TURSO_DATABASE_URL=file:local.db`, and your generated `PAYROLL_ENCRYPTION_KEY_V1` (with `PAYROLL_ACTIVE_KEY_VERSION=v1`).

### 3. Migrate & Seed Local Database
```bash
npm run db:migrate
npm run db:seed
```

### 4. Start Dev Server
```bash
npm run dev
```
Open [http://localhost:3000/payroll](http://localhost:3000/payroll).

---

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start Next.js development server |
| `npm run build` | Build production standalone bundle |
| `npm run start` | Start production Next.js server |
| `npm run lint` | Run Next.js ESLint checks |
| `npm test` | Run Vitest suite sequentially (`--fileParallelism=false`) |
| `npm run db:generate` | Generate Drizzle schema artifacts |
| `npm run db:migrate` | Run schema migrations for the active `PAYROLL_DB_ENV` |
| `npm run db:migrate:production` | Controlled production migration runner |
| `npm run db:seed` | Seed sample roles/users (blocked on non-disposable DBs) |
| `npm run db:rotate-keys` | Rotate encrypted sensitive records to a new key version |

---

## Environment Variables

| Variable | Required | Description |
| :--- | :--- | :--- |
| `PAYROLL_DB_ENV` | Yes | `development`, `staging`, or `production` (no automatic fallback) |
| `TURSO_DATABASE_URL` | Dev | Local SQLite URL (`file:local.db`) |
| `TURSO_STAGING_DATABASE_URL` | Staging | Staging Turso `libsql://` URL |
| `TURSO_STAGING_AUTH_TOKEN` | Staging | Staging Turso auth token |
| `TURSO_PRODUCTION_DATABASE_URL` | Prod | Production Turso `libsql://` URL |
| `TURSO_PRODUCTION_AUTH_TOKEN` | Prod | Production Turso auth token |
| `PAYROLL_ACTIVE_KEY_VERSION` | Yes | Active encryption key version (e.g. `v1`) |
| `PAYROLL_ENCRYPTION_KEY_V1` | Yes | Static 64-character hex string (`openssl rand -hex 32`) |
| `SESSION_SECRET` | Yes | Static secret for signing sessions/OTPs (`openssl rand -hex 32`) |
| `NOTIFY_EMAIL_TOKEN` | Required for OTP emails | MantraCare Notify API Bearer token for OTP email dispatch |
| `NOTIFY_API_URL` | Optional | Defaults to `https://api-notify.mantracare.com/api/v1/notifications/trigger` |
| `OTP_EXPIRY_SECONDS` | Optional | OTP lifetime in seconds (defaults to `900` = 15 minutes) |
| `PROGRAMS_USER_INFO_ENDPOINT` | Optional | Defaults to `https://api.mantracare.com/user/user-info` |

> **Important**: Keep `PAYROLL_ENCRYPTION_KEY_V1` and `SESSION_SECRET` static across container restarts. Changing `PAYROLL_ENCRYPTION_KEY_V1` without running `npm run db:rotate-keys` makes existing encrypted DB fields unreadable.

---

## CI/CD & Deployment (Harbor + Minis)

Pushes to `main` trigger [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml):
1. **Staging Migrations (`migrate-staging-db`)**: Runs `npm run db:migrate` against Turso staging when `TURSO_STAGING_DATABASE_URL` and `TURSO_STAGING_AUTH_TOKEN` secrets are set.
2. **Docker Build & Push (`build-and-push`)**: Builds [`Dockerfile`](Dockerfile) (`node:22-alpine` + Chromium + `@libsql/linux-x64-musl`) and pushes to `bunker.mantracare.com/lovable/payrol` (`:1.2` and `:<sha>`).

### GitHub Repository Secrets
- `USERNAME` / `PASSWORD`: Harbor registry credentials for `bunker.mantracare.com`
- `TURSO_STAGING_DATABASE_URL` / `TURSO_STAGING_AUTH_TOKEN`: Used by CI to apply staging migrations

### Minis Runtime Configuration (`minis.mantracare.com`)
- **Docker Image**: `bunker.mantracare.com/lovable/payrol:1.2`
- **Internal Port**: `80`
- **Strip path prefix before forwarding to container**: **Unchecked** (app expects `/payroll`)
- **Runtime Environment Variables**:
  - `PAYROLL_DB_ENV=staging`
  - `TURSO_STAGING_DATABASE_URL`
  - `TURSO_STAGING_AUTH_TOKEN`
  - `PAYROLL_ACTIVE_KEY_VERSION=v1`
  - `PAYROLL_ENCRYPTION_KEY_V1`
  - `SESSION_SECRET`
  - `NOTIFY_EMAIL_TOKEN`

### Health & Readiness Endpoints
- `GET /payroll/api/health` — Returns database connectivity and encryption readiness status
- `GET /payroll/api/readiness` — Returns schema and index verification report

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for additional deployment and operational details.

