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

ENV NODE_ENV=production
ENV PORT=80
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security compliance
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets and standalone server from builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 80

CMD ["node", "server.js"]
