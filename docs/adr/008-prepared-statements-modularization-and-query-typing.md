# ADR-008: Prepared Statements Modularization & Database Query Strict Typing

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** `apps/backend/src/db/preparedStatements.ts` had grown to 329 LOC with duplicated SQL prepare boilerplate and loose `any` typing across query builders, statement holders, and client arguments.
- **Decision:**
  1. Decomposed column selections into `apps/backend/src/db/preparedColumns.ts` (102 LOC) to separate projection metadata from statement execution mechanics.
  2. Preserved public column exports in `preparedStatements.ts` as a stable barrel facade to prevent breaking changes in repository consumers.
  3. Eliminated all `any` annotations using strongly typed `PreparedLookupStatement<TRow>` matching table `$inferSelect` types.
  4. Implemented DRY `getOrCompileStatement` helper, reducing `preparedStatements.ts` from 329 LOC down to 166 LOC (well within the 300 LOC ceiling).
  5. Eliminated `any` annotations in `dbClient.ts` soft-delete relational guardrails via typed relational callback interfaces.
  6. Ratcheted down repository-wide `any` baseline from 64 to 51 and files over ceiling from 79 to 78.
- **Consequences:** Strictly typed database read path, zero regressions in hot-path queries, reduced cognitive overhead, and machine-enforced compliance with the 300 LOC hard ceiling.

---
