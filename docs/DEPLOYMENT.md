# MantraCare HRMS & Payroll — Deployment & CI/CD Guide

> **Production Platform:** MantraCare Minis Platform (`minis.mantracare.com`)  
> **Registry:** Harbor (`bunker.mantracare.com`)  
> **Project Directory:** `lovable`  
> **Container Port:** `80`  
> **Base Path:** `/payrol`

---

## 1. Container Configuration

### Multi-Stage Dockerfile (Node 22 LTS)
Per project requirements, **Node 20 is not used**. We use the official active LTS `node:22-alpine` image with a multi-stage builder and standalone runner running as a non-root `nextjs` user:

* **Stage 1 (`builder`)**: Installs dependencies and runs `npm run build` using Next.js `output: "standalone"`.
* **Stage 2 (`runner`)**: Copies only `.next/standalone`, `.next/static`, and `public`, exposing port 80.

---

## 2. Harbor Container Registry Setup

* **Registry Endpoint:** `bunker.mantracare.com`
* **Project:** `lovable`
* **Image Name:** `bunker.mantracare.com/lovable/payrol`
* **Tags:** Semantic versioning (e.g. `1.0`, `1.0.1`) and `${{ github.sha }}` for traceability.

### GitHub Repository Secrets:
Set in GitHub (`Settings → Secrets and variables → Actions`):
* `USERNAME`: Harbor service account / user
* `PASSWORD`: Harbor service account token / password

---

## 3. GitHub Actions CI/CD Pipeline

Workflows in `.github/workflows/`:
1. `ci.yml`:
   * Trigger: Pull requests and pushes to non-main branches.
   * Tasks: `npm run lint`, `tsc --noEmit` (typecheck), `npm run test` (security and permission test suites).
2. `docker-publish.yml`:
   * Trigger: Push to `main` branch.
   * Tasks: Setup Docker Buildx, login to `bunker.mantracare.com`, build linux/amd64 container, and push tagged images.

---

## 4. Minis Platform Project Registration

On [minis.mantracare.com](https://minis.mantracare.com):
1. **Project Name:** `Payroll & HRMS`
2. **Slug:** `payrol` *(Must use underscore/alphanumeric, no dashes or slashes)*
3. **Internal Port:** `80`
4. **Docker Image:** `bunker.mantracare.com/lovable/payrol:1.0`
5. **Environment Variables:**
   * `TURSO_DATABASE_URL`: `libsql://[production-db].turso.io`
   * `TURSO_AUTH_TOKEN`: `[secure-token]`
   * `PROGRAMS_USER_INFO_ENDPOINT`: `https://api.mantracare.com/user/user-info`
   * `MOCK_PROGRAMS_API`: `false`
   * `SESSION_SECRET`: `[32-char-random-secret]`

---

## 5. Rollback Procedure
If a production issue occurs:
1. Log in to [minis.mantracare.com](https://minis.mantracare.com).
2. Select the `payrol` project.
3. Update the **Docker image** field to the previously stable image tag (e.g. `bunker.mantracare.com/lovable/payrol:1.0.0`).
4. Click **Pause**, then **Play** to trigger the rolling container replacement.

