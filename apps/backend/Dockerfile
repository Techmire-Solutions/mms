# Build from repository root:
#   docker build -f apps/backend/Dockerfile -t mms-backend .
#
# Run:
#   docker run -p 5002:5002 -e JWT_SECRET=... -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/mms mms-backend

FROM node:24-alpine AS base
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable && corepack prepare pnpm@11.15.1 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
COPY packages/be-core/package.json ./packages/be-core/
COPY packages/modules/iam/package.json ./packages/modules/iam/
COPY packages/modules/accounting/package.json ./packages/modules/accounting/
COPY packages/modules/contacts/package.json ./packages/modules/contacts/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/contracts ./packages/contracts
COPY packages/db ./packages/db
COPY packages/be-core ./packages/be-core
COPY packages/modules/iam ./packages/modules/iam
COPY packages/modules/accounting ./packages/modules/accounting
COPY packages/modules/contacts ./packages/modules/contacts
COPY apps/backend ./apps/backend
RUN pnpm --filter @mms/contracts build && pnpm --filter @mms/db build && pnpm --filter @mms/be-core build && pnpm --filter @mms/mod-iam build && pnpm --filter @mms/mod-accounting build && pnpm --filter @mms/mod-contacts build && pnpm --filter mms-backend build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
COPY packages/be-core/package.json ./packages/be-core/
COPY packages/modules/iam/package.json ./packages/modules/iam/
COPY packages/modules/accounting/package.json ./packages/modules/accounting/
COPY packages/modules/contacts/package.json ./packages/modules/contacts/
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/be-core/dist ./packages/be-core/dist
COPY --from=build /app/packages/modules/iam/dist ./packages/modules/iam/dist
COPY --from=build /app/packages/modules/accounting/dist ./packages/modules/accounting/dist
COPY --from=build /app/packages/modules/contacts/dist ./packages/modules/contacts/dist
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/packages/db/migrations_drizzle ./packages/db/migrations_drizzle

RUN pnpm install --frozen-lockfile --prod --filter mms-backend

WORKDIR /app/apps/backend

# Non-root runtime: apps/backend may create uploads/ at runtime
# (config/storage.ts). No HEALTHCHECK here on purpose — the worker container
# shares this image and serves no HTTP; see docker-compose.yml instead.
RUN mkdir -p /app/apps/backend/uploads \
  && chown -R node:node /app/apps/backend
USER node

# Override at runtime — default to PostgreSQL database
ENV DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/mms

ENV PORT=5002

EXPOSE 5002

CMD ["node", "dist/index.js"]
