# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat \
    && corepack enable

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --frozen-lockfile
RUN pnpm install --frozen-lockfile --offline

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- Production ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install Chromium, dependencies, and CJK fonts for PDF export
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont \
    font-noto-cjk

# Tell puppeteer / generate-pdf to use the system Chromium
ENV CHROME_PATH=/usr/bin/chromium-browser

# Copy build output and necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Drizzle migration files (for auto-migration on startup)
COPY --from=builder /app/drizzle ./drizzle

# Data directory for SQLite
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null || exit 1

CMD ["node", "server.js"]
