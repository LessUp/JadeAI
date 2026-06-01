# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
ARG DEBIAN_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian
ARG DEBIAN_SECURITY_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian-security
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN set -eux; \
    printf '%s\n' \
      'Acquire::Retries "5";' \
      'Acquire::http::Timeout "30";' \
      'Acquire::https::Timeout "30";' \
      'Acquire::http::No-Cache "true";' \
      > /etc/apt/apt.conf.d/80-network-retries; \
    if [ -n "$DEBIAN_MIRROR" ]; then \
      sed -E -i "s|https?://deb.debian.org/debian|${DEBIAN_MIRROR%/}|g" /etc/apt/sources.list.d/debian.sources; \
    fi; \
    if [ -n "$DEBIAN_SECURITY_MIRROR" ]; then \
      sed -E -i "s|https?://deb.debian.org/debian-security|${DEBIAN_SECURITY_MIRROR%/}|g" /etc/apt/sources.list.d/debian.sources; \
    fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates; \
    rm -rf /var/lib/apt/lists/*
RUN corepack enable

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- Production ---
FROM base AS runner
ARG APP_VERSION=0.0.0-dev
ARG VCS_REF=unknown
ARG BUILD_DATE=unknown
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CHROME_PATH=/usr/bin/chromium \
    SQLITE_PATH=/app/data/jade.db \
    APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.title="JadeAI" \
      org.opencontainers.image.description="AI-powered resume and job-search workspace" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.source="https://github.com/LessUp/JadeAI" \
      org.opencontainers.image.url="https://github.com/LessUp/JadeAI" \
      org.opencontainers.image.licenses="Apache-2.0"

# Install Chromium and fonts for PDF export
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium ca-certificates fonts-freefont-ttf fonts-noto-cjk wget \
    && rm -rf /var/lib/apt/lists/*

# Copy build output and necessary files
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Drizzle migration files (for auto-migration on startup)
COPY --from=builder --chown=node:node /app/drizzle ./drizzle

# Data directory for SQLite (the named volume inherits this ownership on first run)
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME /app/data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null || exit 1

CMD ["node", "server.js"]
