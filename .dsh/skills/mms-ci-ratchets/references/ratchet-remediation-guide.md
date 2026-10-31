# MMS CI Ratchets & Quality Gates Remediation Guide

This guide details the custom AST and heuristic ratchets enforced across the MMS monorepo, their underlying invariants, failure signatures, and exact remediation recipes.

---

## 1. Ratchet Overview & Trigger Matrix

| Ratchet Command | Script Path | What It Catches | Remediation |
|---|---|---|---|
| `pnpm run check:backend-boundaries` | `scripts/check-backend-boundaries.mjs` | Route handlers directly importing Drizzle ORM or DB repositories | Delegate database access through domain use-cases / services |
| `pnpm run check:code-norms` | `scripts/check-code-norms.mjs` | Files exceeding 300 LOC cap, raw hex colors, usage of `any` | Extract subcomponents, use design tokens, enforce strict TS |
| `pnpm run check:db-projections` | `scripts/check-db-projections.mjs` | Unconstrained `select()` or `findMany()` wildcard fetches | Explicitly declare requested columns in SQL/Drizzle projections |
| `pnpm run check:work-directory` | `scripts/check-work-directory.mjs` | 6 Work directory invariants (dual CSS render, non-DataTable tables) | Consolidate onto `DataTable` / `WorkBatchTable` and `DirectoryCard` |
| `pnpm run check:shared-ui` | `scripts/check-shared-ui.mjs` | Duplicate UI component files across Tenant & Platform consoles | Import from `@shared/ui` (`packages/ui`); retire console forks |
| `pnpm run check:faculty-domain` | `scripts/check-faculty-domain.mjs` | Retired legacy nomenclature (`/api/teachers`, `FDA`) | Use `facultyDesignations`, `facultyAssignments`, `facultyDepartments` |
| `pnpm run check:migrations-forward-only` | `scripts/check-migrations-forward-only.mjs` | Historical SQL migration modification | Only append forward DDL migrations; never rewrite existing SQL |
| `node scripts/verify-rules-integrity.mjs` | `scripts/verify-rules-integrity.mjs` | Stale mirrors, broken citations, or frontmatter defects | Run `.agent/scripts/sync-all.sh` and align frontmatter |

---

## 2. Common Failures & Surgical Fixes

### A. Backend Layering Boundaries (`check-backend-boundaries.mjs`)

- **Failure:** `Route file 'apps/backend/src/routes/.../contacts.ts' imports 'drizzle-orm' or database pool directly.`
- **Why:** Route handlers are HTTP translation layers. They handle authentication, input validation (`zod`), status mapping, and response serialization. Business logic and database mutations must live in domain services.
- **Fix:**
  ```typescript
  // ❌ Prohibited in route handler
  import { db } from '@/db';
  import { eq } from 'drizzle-orm';
  await db.select().from(contacts).where(eq(contacts.id, id));

  // ✅ Required: Delegate to domain service
  import { getContactById } from '@/contacts/services/contactService';
  const contact = await getContactById(tenantId, id);
  ```

### B. 300 LOC File Size Cap (`check-code-norms.mjs`)

- **Failure:** `File exceeds 300 LOC limit (current: 342 lines).`
- **Why:** High LOC files create review drag, increase merge conflict frequency, and degrade AI context efficiency.
- **Fix:** Decompose oversized modules:
  - Form dialogs: Split into `*FormModal.tsx`, `*FormTabs.tsx`, and `use*FormState.ts`.
  - Directories: Separate table column definitions (`*Columns.tsx`), bulk action bars (`*BulkActions.tsx`), and filter sheets (`*FilterSheet.tsx`).
  - Route handlers: Group related sub-actions into dedicated route plugin files under the domain directory.

### C. Prohibited Wildcard Projections (`check-db-projections.mjs`)

- **Failure:** `Unconstrained select() detected in query.`
- **Why:** Fetching all columns triggers unintentional memory leaks, bypasses crypto-shredded field handling, and degrades index-only scan performance.
- **Fix:**
  ```typescript
  // ❌ Prohibited
  const rows = await db.select().from(students).where(eq(students.workspaceId, tenantId));

  // ✅ Required
  const rows = await db.select({
    id: students.id,
    fullName: students.fullName,
    grNumber: students.grNumber,
    status: students.status,
  }).from(students).where(eq(students.workspaceId, tenantId));
  ```

### D. Work Directory Dual-Render Invariant (`check-work-directory.mjs`)

- **Failure:** `Dual-render CSS pattern detected (e.g. md:hidden / md:block on separate desktop/mobile trees).`
- **Why:** Dual-rendering renders the entire data tree twice into the DOM, breaking accessibility focus chains and doubling mount costs.
- **Fix:** Use unified responsive components (`DirectoryCard` or unified `DataTable` responsive columns) that switch presentation via CSS Grid/Flex tokens rather than mounting duplicate DOM trees.

---

## 3. Pre-Commit / Pre-Push Validation Workflow

Run the affected-only check before every commit:

```bash
pnpm ci:local
```

Before opening a pull request or pushing to remote, run the full verification:

```bash
node scripts/verify-rules-integrity.mjs
pnpm run check:backend-boundaries
pnpm run check:code-norms
pnpm run check:work-directory
pnpm run check:shared-ui
```
