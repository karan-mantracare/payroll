> ## Documentation Index
> Fetch the complete documentation index at: https://minis-workflow.mintlify.site/llms.txt
> Use this file to discover all available pages before exploring further.

# Phase 2: Ship the container

> Push your code to GitHub, configure CI pipelines, containerize your app, and deploy it to the Minis platform.

### Step 1: Create and push a new repo

Once you're happy with the UI, cut it loose from any template repo and give it its own home. Pick a **slug** for the project now; you'll reuse it everywhere (git repo name, Docker image name, Next.js base path, and the Minis project slug).

> [!NOTE]
>
> **Naming rule:** The Git repo and Docker image slug can use dashes (e.g. `mind-whisperer`). However, the **Minis platform project slug** (in Step 7) does **not** support dashes; use underscores there instead (e.g. `mind_whisperer`). Keep this distinction in mind or your deployment step will silently fail to match.

```bash theme={null}
# From inside your project folder
git init
git add .
git commit -m "Initial commit: <your-slug> mini"

# Create the repo on GitHub first (via the UI, under your own account), then:
git remote add origin https://github.com/<your-github-username>/<your-slug>.git
git branch -M main
git push -u origin main
```

Or, if you have the [GitHub CLI](https://cli.github.com/) installed, create + push in one shot:

```bash theme={null}
gh repo create <your-slug> --private --source=. --remote=origin --push
```

Go to your repo on GitHub and confirm the code actually landed on `main`.

### Step 2: Add CI secrets

Navigate to:

```text theme={null}
https://github.com/<your-org>/<your-slug>/settings/secrets/actions
```

Add two **repository secrets** (`Settings → Secrets and variables → Actions → New repository secret`):

| Secret name | Value |
| - | - |
| `USERNAME` | Your `bunker.mantracare.com` username |
| `PASSWORD` | Your `bunker.mantracare.com` password |

These are consumed by the GitHub Actions workflow in Step 6 to log in to our private registry.

### Step 3: Configure Next.js for subpath hosting

Your Mini is hosted at a subpath (`domain.com/your-app`), not at root, so Next.js needs to know that.

> [!TIP]
>
> Don't want to hand-write these config files? Use the **[Deployment Config Generator](https://minis.mantracare.com/tools/deployment-helper)**; it spits out all of them pre-filled with your slug. The manual steps below are for when you want full control or the generator doesn't cover your edge case.

Edit `next.config.js`:

```js theme={null}
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  basePath: "/your-slug",
  assetPrefix: "/your-slug",
}

module.exports = nextConfig
```

Replace `/your-slug` with your actual project slug. With `basePath` set, every `<Link>` and `router.push()` call in the app is automatically prefixed; there's no per-route routing config to touch. Just make sure nothing in the codebase hardcodes an absolute path like `/dashboard` instead of using Next's router/`Link`.

### Step 4: .dockerignore

Create a `.dockerignore` in the project root so secrets and build junk never make it into the image:

```bash theme={null}
# Dependencies
node_modules
.pnp
.pnp.js

# Build output
.next
out

# Version control
.git
.gitignore

# Environment variables (safety first!)
# Only allow a standard .env if you strictly commit public config there.
# Always ignore local overrides containing secrets.
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE / editor
.vscode
.idea
*.swp
*.swo

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Testing
coverage

# OS
.DS_Store
Thumbs.db

# Docker config itself, avoid cache invalidation when only config changes
Dockerfile
docker-compose.yml
README.md
```

### Step 5: Dockerfile

Create a `Dockerfile` in the project root. This multi-stage builds the Next.js app using its `standalone` output and runs it directly on port 80, no separate web server needed.

```dockerfile theme={null}
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 80
CMD ["node", "server.js"]
```

> [!WARNING]
>
> The slug in `next.config.js` and the image name/tag you reference on the Minis platform **must match exactly**. A mismatch here is the #1 cause of blank-screen deploys.

### Step 6: Automate the Docker build with GitHub Actions CI

You don't need Docker installed locally at all; GitHub Actions builds and pushes the image for you on every push. Create `.github/workflows/docker-publish.yml`:

```yaml theme={null}
name: Build and Push Docker Image

on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to bunker registry
        uses: docker/login-action@v3
        with:
          registry: bunker.mantracare.com
          username: ${{ secrets.USERNAME }}
          password: ${{ secrets.PASSWORD }}

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64
          push: true
          tags: bunker.mantracare.com/lovable/your-slug:1.0
```

> [!NOTE]
>
> This workflow builds a new image on every push to `main` and tags it `1.0`. Once you're past initial setup, switch to a versioned or `${{ github.sha }}`-based tag so you don't silently overwrite production images on every merge.

Commit and push to trigger it:

```bash theme={null}
git add .
git commit -m "Add Docker + CI config for deployment"
git push
```

Watch the **Actions** tab on GitHub until the workflow run turns green; that's your image built and pushed to `bunker.mantracare.com` with no local Docker step required.

### Step 7: Create the project on the Minis platform

Once CI is green, go to [minis.mantracare.com](https://minis.mantracare.com) and create a new project:

| Field | Value |
| - | - |
| Project name | Anything descriptive, free text |
| Slug | Your slug, **underscore-separated** (e.g. `mind_whisperer`); dashes are not supported here |
| Internal port | `80` |
| Docker image | `bunker.mantracare.com/lovable/your-slug:1.0` |

Hit **Save**, then hit **Play** to deploy and view the live version.

> [!TIP]
>
> Once you're happy with the deployed frontend, move on to [Phase 3](https://minis-workflow.mintlify.site/phases/phase-3-database-auth.md).


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.