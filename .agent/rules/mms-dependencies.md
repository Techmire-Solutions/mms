---
trigger: model_decision
description: Node 24, pnpm catalogs, package versions, React Compiler, and dependency audit rules
---

# Dependencies & Tech Stack

**Workflow skill:** `mms-dependency-upgrade` (catalogs, Dependabot, audits, React Compiler). Day-to-day install/run → `mms-dev-setup`.

## 1. Baseline & Workspace Catalogs
- **Runtimes & Tooling:** Node.js `>=24.14.0` (LTS `engines.node`), Corepack `pnpm@11.15.1`, Turborepo `^2.11.7`, TypeScript `~7.0.2` (with `typescript-v6` compatibility alias).
- **Catalogs (`pnpm-workspace.yaml`):** React/React-DOM `^19.3.0`, React Router (`react-router-dom`) `^7.18.4`, Vite `^8.3.0`, Fastify `^5.12.5`, Pino `^10.3.1`, Drizzle ORM `^0.45.3`, Zod `^4.6.5`, TanStack Query `^5.103.2`, `@ts-rest/react-query` `3.52.1`. Apps cannot drift majors.
- **E2E & Shared:** Playwright (`@playwright/test`) `^1.63.0`, axe-core `^4.13.0`, `@ts-rest/core`. Workspace protocol (`workspace:*`) mandatory for `@mms/shared`.

## 2. Upgrade Workflow
- **Dedicated PRs Only:** Never bump dependencies mid-feature.
- **Procedure:** Run `pnpm outdated -r` → bump stale deps → `pnpm install && pnpm typecheck && pnpm test` → app lints (`cd apps/frontend && pnpm lint`, `cd apps/backend && pnpm lint`) → `pnpm audit` (resolve high+ CVEs) → resolve breaking API changes in the same commit.

## 3. Node 24 Native Built-Ins & Banned Dependencies
- **Configuration:** Use native `--env-file=.env` or `process.loadEnvFile()`. Ban `dotenv`.
- **Networking:** Use native global `fetch()`, `FormData`, and global `WebSocket`. Ban `axios`, `node-fetch`.
- **Filesystem:** Use `import { glob } from 'node:fs/promises'`. Ban `glob`, `fast-glob`.
- **Crypto & Hashing:** Use `crypto.hash()` from `node:crypto`. Ban verbose `createHash().update().digest()` chains.
- **URLs & Routing:** Use `URLPattern` and WHATWG `new URL()`. Ban `path-to-regexp`, legacy `url.parse()`.
- **Core Imports:** Mandatory `node:` prefix (`node:fs/promises`, `node:crypto`, `node:path`). Ban unprefixed core imports.
- **Resource Management:** Use `using` / `await using` for cleanup. Ban manual `try/finally` connection boilerplate.
- **Request Tracing:** Use `AsyncLocalStorage` via `AsyncContextFrame`. Ban manual trace context parameter drilling.
- **Testing & Execution:** Use `vitest` everywhere. Ban `jest`, `mocha`. Use `--experimental-strip-types` for CLI scripts.
- **Pathing & Encodings:** Use `import.meta.dirname`, `Uint8Array.prototype.toBase64()`, and `Uint8Array.fromHex()`. Ban `fileURLToPath` boilerplate and bespoke base64/hex encoders.

## 4. Pinning & Supply Chain Rules
- **Strict Semver:** Match exact `packageManager` and `engines` across CI/Docker.
- **Script Containment:** Enforce `pnpm.onlyBuiltDependencies` allowlist for native/postinstall scripts. Arbitrary unreviewed postinstalls are banned.
- **Automated Audits:** Enable Dependabot/Renovate + GitHub `dependency-review` on PRs. Do not leave known high+ CVEs unpatched.

## 5. TypeScript Strictness & Erasable Syntax
- **Type Stripping Invariants (`--experimental-strip-types`):**
  - ❌ Banned: `enum` — use string literal unions (`type Status = 'active' | 'archived'`) or `as const` maps.
  - ❌ Banned: `namespace` / `module` declarations.
  - ❌ Banned: Constructor parameter properties (`constructor(public name: string)`).
  - ✅ Required: Explicit class property declarations, `import type`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`.

## 6. React Compiler (When Enabling)
- Add plugin strictly to `apps/frontend/vite.config.ts` (never root).
- Verify with `pnpm typecheck`, `pnpm test`, and FE lint before removing working manual memoization.

