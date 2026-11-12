# ==============================================================================
# MANTRACARE PAYROLL — DOCKERFILE
# Platform: MantraCare Minis (bunker.mantracare.com)
# Node Version: Node 22 LTS (Alpine) — Node 20 is strictly prohibited
# Port: 80
# ==============================================================================

# Stage 1: Build dependencies & application
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Skip Puppeteer Chrome-for-Testing download during Alpine build; system Chromium is installed in runner
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Cache dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build Next.js standalone application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

# Install Alpine Chromium + fonts for headless A4 PDF payslip generation
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

ENV NODE_ENV=production
ENV PORT=80
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create non-root user for security compliance
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets, standalone server, and writable app data directories
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@libsql/linux-x64-musl ./node_modules/@libsql/linux-x64-musl

RUN mkdir -p /app/.storage/documents && chown -R nextjs:nodejs /app/.storage

USER nextjs

EXPOSE 80

CMD ["node", "server.js"]
