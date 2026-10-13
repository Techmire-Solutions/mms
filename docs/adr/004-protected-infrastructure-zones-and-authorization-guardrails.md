# ADR-004: Protected Infrastructure Zones and Authorization Guardrails

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Automated agents or inadvertent modifications to critical infrastructure (migrations, authentication, CI/CD, build tools) can destabilize the entire platform.
- **Decision:**
  1. The following core infrastructure zones are declared Protected Zones and must NOT be modified without explicit, logged user authorization:
     - Database migrations (`apps/backend/src/db/migrations_drizzle/`, `migrations/`)
     - Authentication middleware and session infrastructure (`apps/backend/src/middleware/authenticate*.ts`, `apps/backend/src/services/auth/`)
     - CI/CD pipelines, Dockerfiles, and deployment configs (`.github/workflows/`, `Dockerfile*`)
     - Global build configs (`tsconfig.json`, `tailwind.config.js`, `vite.config.ts`)
  2. Dependency additions are forbidden without prior review; existing workspace catalog dependencies must be inspected first.
- **Consequences:** Protected core systems remain immutable against unintended agentic regressions.

---
