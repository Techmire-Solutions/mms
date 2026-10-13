# ADR-011: Backend Route→Storage Boundary (enforced ratchet)

- **Status:** Accepted & Enforced
- **Date:** 2026-10-12
- **Context:** The documented chain is routes → use-cases → repository interface → Drizzle adapter (`SYSTEM_ARCHITECTURE.md` §5), but 19 route files imported `db/repositories/**` or `drizzle-orm` directly — the handler owned SQL, bypassed the module's repository seam, and could not be unit-tested with a fake repository. A dynamic `await import("…/db/repositories/…")` had gone unnoticed by static review.
- **Decision:**
  1. Route files reach storage only through their module's `use-cases`/`repository` seam; each migrated module exposes `create<Module>UseCases(repo = adapter)`.
  2. `scripts/check-backend-boundaries.mjs` enforces this as a ratchet at **baseline 0** — any new static **or dynamic** `db/repositories` / `drizzle-orm` import in `apps/backend/src/routes/**` fails.
  3. It runs from `pre-pr-review.sh` in both scopes, gating every local push.
- **Consequences:** All 19 offenders migrated (tasks, savedReports, faculty catalog, audit, platform, users/workspace bridges). Future route→storage shortcuts fail immediately. Wiring into `.github/workflows/ci.yml` is still pending — see Open items.

---
