# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl su-exec
WORKDIR /app

FROM base AS deps
# prisma/ is required before npm ci because postinstall runs `prisma generate`
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/tmp/build.sqlite
# Regenerate after full source copy (build script also runs prisma generate)
RUN npx prisma generate
RUN npm run build

# Standalone Next.js does not ship the Prisma CLI. Install it separately so
# `migrate deploy` has the CLI, transitive deps, and Alpine-compatible engines.
FROM base AS prisma-cli
WORKDIR /opt/prisma
COPY package.json /tmp/app-package.json
RUN npm init -y >/dev/null \
  && PRISMA_VERSION=$(node -p "require('/tmp/app-package.json').devDependencies.prisma.replace(/^[^\d]*/, '')") \
  && npm install "prisma@${PRISMA_VERSION}" --omit=dev \
  && rm -rf /tmp/app-package.json /root/.npm

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/data/db.sqlite

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /app/data \
  && chown -R nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=prisma-cli /opt/prisma /opt/prisma
COPY --from=builder /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh

# Entrypoint starts as root to fix /app/data ownership on bind mounts,
# then drops privileges to nextjs for migrate + server.
EXPOSE 3000

CMD ["/app/docker-entrypoint.sh"]
