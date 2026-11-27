# Build from repository root:
#   docker build -f apps/api/Dockerfile -t mms-api .
#
# Run:
#   docker run -p 5002:5002 -e JWT_SECRET=... -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/mms mms-api
#
# `turbo prune` derives the API's workspace dependency closure (contracts, db,
# be-core, module backends) from the package graph instead of a hand-maintained
# COPY list, and prunes the lockfile so `pnpm install` only resolves those deps.
# The worker container shares this image (see docker-compose.yml) and overrides
# only the CMD, so a single prune scope (`mms-api`) covers both processes.

FROM node:24-alpine AS base
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable && corepack prepare pnpm@11.15.1 --activate
# Pin the prune/build CLI to the repo's turbo version (^2.11.13 → 2.11.13).
RUN pnpm add -g turbo@2.11.13
WORKDIR /app

FROM base AS pruner
COPY . .
# `--docker` emits out/json (manifests), out/full (source), and a pruned lockfile.
# `pruneIncludesGlobalFiles` (turbo.json future flag) also carries tooling/**,
# tsconfig.base.json and scripts/eslint-ts-compat.cjs so `tsc` still resolves.
RUN turbo prune --scope=mms-api --docker

# Install from the pruned manifests first (manifests change less often than source).
FROM base AS builder
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=mms-api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --prod --filter mms-api
# Built artifacts (the API image runs from dist/, never from source).
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/db/migrations_drizzle ./packages/db/migrations_drizzle
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/be-core/dist ./packages/be-core/dist
COPY --from=builder /app/packages/modules/accounting/dist ./packages/modules/accounting/dist
COPY --from=builder /app/packages/modules/analytics/dist ./packages/modules/analytics/dist
COPY --from=builder /app/packages/modules/attendance/dist ./packages/modules/attendance/dist
COPY --from=builder /app/packages/modules/audit/dist ./packages/modules/audit/dist
COPY --from=builder /app/packages/modules/billing/dist ./packages/modules/billing/dist
COPY --from=builder /app/packages/modules/contacts/dist ./packages/modules/contacts/dist
COPY --from=builder /app/packages/modules/documents/dist ./packages/modules/documents/dist
COPY --from=builder /app/packages/modules/enrollments/dist ./packages/modules/enrollments/dist
COPY --from=builder /app/packages/modules/examinations/dist ./packages/modules/examinations/dist
COPY --from=builder /app/packages/modules/faculty/dist ./packages/modules/faculty/dist
COPY --from=builder /app/packages/modules/hasanat/dist ./packages/modules/hasanat/dist
COPY --from=builder /app/packages/modules/iam/dist ./packages/modules/iam/dist
COPY --from=builder /app/packages/modules/messaging/dist ./packages/modules/messaging/dist
COPY --from=builder /app/packages/modules/notifications/dist ./packages/modules/notifications/dist
COPY --from=builder /app/packages/modules/obligations/dist ./packages/modules/obligations/dist
COPY --from=builder /app/packages/modules/platform/dist ./packages/modules/platform/dist
COPY --from=builder /app/packages/modules/question-bank/dist ./packages/modules/question-bank/dist
COPY --from=builder /app/packages/modules/sessions/dist ./packages/modules/sessions/dist
COPY --from=builder /app/packages/modules/students/dist ./packages/modules/students/dist
COPY --from=builder /app/packages/modules/tasks/dist ./packages/modules/tasks/dist
COPY --from=builder /app/packages/modules/workshops/dist ./packages/modules/workshops/dist

WORKDIR /app/apps/api

# Non-root runtime: apps/api may create uploads/ at runtime
# (config/storage.ts). No HEALTHCHECK here on purpose — the worker container
# shares this image and serves no HTTP; see docker-compose.yml instead.
RUN mkdir -p /app/apps/api/uploads \
  && chown -R node:node /app/apps/api
USER node

# Override at runtime — default to PostgreSQL database
ENV DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/mms

ENV PORT=5002

EXPOSE 5002

CMD ["node", "dist/index.js"]
