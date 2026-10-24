# ADR-003: Strict Type Safety & Runtime Zod Contracts at Boundaries

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** TypeScript types are erased at runtime. Relying solely on compile-time types or `any`/untyped dictionaries creates security holes, deserialization bugs, and runtime crashes.
- **Decision:**
  1. Zero tolerance for `any`, untyped object literals/dictionaries, and `unknown` without explicit narrowing type guards.
  2. Double assertions (`as unknown as T`) to bypass validation are forbidden.
  3. All API boundaries, external payloads, and database persistence operations must be validated against runtime Zod schemas defined in `@mms/shared` (using `.strict()` for write DTOs).
- **Consequences:** Total type safety at compile time and runtime integrity at system boundaries.

---
