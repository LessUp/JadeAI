# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
ARG DEBIAN_MIRROR=http://mirrors.ustc.edu.cn/debian
ARG DEBIAN_SECURITY_MIRROR=http://mirrors.ustc.edu.cn/debian-security
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN set -eux; \
    proxy_http="${HTTP_PROXY:-${http_proxy:-}}"; \
    proxy_https="${HTTPS_PROXY:-${https_proxy:-}}"; \
    proxy_no="${NO_PROXY:-${no_proxy:-}}"; \
    use_node_proxy=true; \
    case "$proxy_http" in socks5://*|socks5h://*) use_node_proxy=false ;; esac; \
    case "$proxy_https" in socks5://*|socks5h://*) use_node_proxy=false ;; esac; \
    if [ "$use_node_proxy" = "true" ] && [ -n "$proxy_http" ]; then export http_proxy="$proxy_http" HTTP_PROXY="$proxy_http"; fi; \
    if [ "$use_node_proxy" = "true" ] && [ -n "$proxy_https" ]; then export https_proxy="$proxy_https" HTTPS_PROXY="$proxy_https"; fi; \
    if [ -n "$proxy_no" ]; then export no_proxy="$proxy_no" NO_PROXY="$proxy_no"; fi; \
    if [ "$use_node_proxy" = "false" ]; then unset http_proxy HTTP_PROXY https_proxy HTTPS_PROXY; fi; \
    printf '%s\n' \
      'Acquire::Retries "20";' \
      'Acquire::http::Timeout "60";' \
      'Acquire::https::Timeout "60";' \
      'Acquire::http::Pipeline-Depth "0";' \
      'Acquire::https::Pipeline-Depth "0";' \
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
RUN set -eux; \
    proxy_http="${HTTP_PROXY:-${http_proxy:-}}"; \
    proxy_https="${HTTPS_PROXY:-${https_proxy:-}}"; \
    proxy_no="${NO_PROXY:-${no_proxy:-}}"; \
    if [ -n "$proxy_http" ]; then export http_proxy="$proxy_http" HTTP_PROXY="$proxy_http"; fi; \
    if [ -n "$proxy_https" ]; then export https_proxy="$proxy_https" HTTPS_PROXY="$proxy_https"; fi; \
    if [ -n "$proxy_no" ]; then export no_proxy="$proxy_no" NO_PROXY="$proxy_no"; fi; \
    corepack enable; \
    corepack prepare pnpm@11.0.9 --activate

# --- Dependencies ---
FROM base AS deps
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
WORKDIR /app
RUN set -eux; \
    proxy_http="${HTTP_PROXY:-${http_proxy:-}}"; \
    proxy_https="${HTTPS_PROXY:-${https_proxy:-}}"; \
    proxy_no="${NO_PROXY:-${no_proxy:-}}"; \
    if [ -n "$proxy_http" ]; then export http_proxy="$proxy_http" HTTP_PROXY="$proxy_http"; fi; \
    if [ -n "$proxy_https" ]; then export https_proxy="$proxy_https" HTTPS_PROXY="$proxy_https"; fi; \
    if [ -n "$proxy_no" ]; then export no_proxy="$proxy_no" NO_PROXY="$proxy_no"; fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends python3 make g++; \
    rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    set -eux; \
    proxy_http="${HTTP_PROXY:-${http_proxy:-}}"; \
    proxy_https="${HTTPS_PROXY:-${https_proxy:-}}"; \
    proxy_no="${NO_PROXY:-${no_proxy:-}}"; \
    use_node_proxy=true; \
    case "$proxy_http" in socks5://*|socks5h://*) use_node_proxy=false ;; esac; \
    case "$proxy_https" in socks5://*|socks5h://*) use_node_proxy=false ;; esac; \
    if [ "$use_node_proxy" = "true" ] && [ -n "$proxy_http" ]; then export http_proxy="$proxy_http" HTTP_PROXY="$proxy_http"; fi; \
    if [ "$use_node_proxy" = "true" ] && [ -n "$proxy_https" ]; then export https_proxy="$proxy_https" HTTPS_PROXY="$proxy_https"; fi; \
    if [ -n "$proxy_no" ]; then export no_proxy="$proxy_no" NO_PROXY="$proxy_no"; fi; \
    if [ "$use_node_proxy" = "false" ]; then unset http_proxy HTTP_PROXY https_proxy HTTPS_PROXY; fi; \
    pnpm fetch --frozen-lockfile
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    set -eux; \
    proxy_http="${HTTP_PROXY:-${http_proxy:-}}"; \
    proxy_https="${HTTPS_PROXY:-${https_proxy:-}}"; \
    proxy_no="${NO_PROXY:-${no_proxy:-}}"; \
    use_node_proxy=true; \
    case "$proxy_http" in socks5://*|socks5h://*) use_node_proxy=false ;; esac; \
    case "$proxy_https" in socks5://*|socks5h://*) use_node_proxy=false ;; esac; \
    if [ "$use_node_proxy" = "true" ] && [ -n "$proxy_http" ]; then export http_proxy="$proxy_http" HTTP_PROXY="$proxy_http"; fi; \
    if [ "$use_node_proxy" = "true" ] && [ -n "$proxy_https" ]; then export https_proxy="$proxy_https" HTTPS_PROXY="$proxy_https"; fi; \
    if [ -n "$proxy_no" ]; then export no_proxy="$proxy_no" NO_PROXY="$proxy_no"; fi; \
    if [ "$use_node_proxy" = "false" ]; then unset http_proxy HTTP_PROXY https_proxy HTTPS_PROXY; fi; \
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
ARG INSTALL_CHROMIUM=true
ARG INSTALL_CJK_FONTS=true
ARG ALLOW_CHROMIUM_DOWNLOAD=false
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CHROME_PATH=/usr/bin/chromium \
    SQLITE_PATH=/app/data/jade.db \
    ALLOW_CHROMIUM_DOWNLOAD=${ALLOW_CHROMIUM_DOWNLOAD} \
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
RUN set -eux; \
    proxy_http="${HTTP_PROXY:-${http_proxy:-}}"; \
    proxy_https="${HTTPS_PROXY:-${https_proxy:-}}"; \
    proxy_no="${NO_PROXY:-${no_proxy:-}}"; \
    if [ -n "$proxy_http" ]; then export http_proxy="$proxy_http" HTTP_PROXY="$proxy_http"; fi; \
    if [ -n "$proxy_https" ]; then export https_proxy="$proxy_https" HTTPS_PROXY="$proxy_https"; fi; \
    if [ -n "$proxy_no" ]; then export no_proxy="$proxy_no" NO_PROXY="$proxy_no"; fi; \
    apt-get update; \
    apt_retry_install() { \
      attempt=1; \
      while [ "$attempt" -le 8 ]; do \
        if apt-get install -y --no-install-recommends --fix-missing "$@"; then \
          return 0; \
        fi; \
        if [ "$attempt" -eq 8 ]; then \
          return 1; \
        fi; \
        attempt=$((attempt + 1)); \
        sleep 3; \
        apt-get update || true; \
      done; \
    }; \
    apt_retry_install ca-certificates wget fonts-freefont-ttf; \
    if [ "$INSTALL_CJK_FONTS" = "true" ]; then \
      apt_retry_install fonts-noto-cjk; \
    fi; \
    if [ "$INSTALL_CHROMIUM" = "true" ]; then \
      apt_retry_install chromium; \
    fi; \
    rm -rf /var/lib/apt/lists/*

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
