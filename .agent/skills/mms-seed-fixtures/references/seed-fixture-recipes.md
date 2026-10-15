# MMS Database Seed & Fixture Recipes

This guide documents the database seeding patterns, topological dependency ordering, and reset protocols used across local development and Playwright E2E suites.

---

## 1. Topological Reset & Dependency Order

Because PostgreSQL tables enforce foreign key constraints, module tables must be reset and populated according to strict topological order:

```
[ Workspaces / Platform ]
          │
          ▼
   [ Users & Roles ] ──────────► [ Contacts ]
                                     │
          ┌──────────────────────────┴──────────────────────────┐
          ▼                                                     ▼
     [ Faculty ]                                           [ Students ]
          │                                                     │
          │                                                     ▼
          │                                              [ Enrollments ]
          │                                                     │
          └──────────────────────────┬──────────────────────────┘
                                     ▼
                    [ Sessions, Attendance, Exams ]
                                     │
                                     ▼
                          [ Invoices & Finance ]
```

### Topological Execution Scripts
- **Full Topological Reset:** `apps/backend/src/scripts/resetAllModulesTopological.ts`
- **Selective Reset (Preserving Contacts):** `apps/backend/src/scripts/resetAllModulesExceptContacts.ts`
- **Baseline Application Reset:** `apps/backend/src/scripts/reset-app-db.ts`

---

## 2. Standard Fixture Runners

MMS provides standard 20-row deterministic fixture scripts under `apps/backend/src/scripts/`:

```bash
# 1. Reset all application tables topologically
pnpm --filter mms-backend db:reset

# 2. Seed platform super user & workspace
pnpm --filter mms-backend exec tsx src/scripts/seedSuperUser.ts

# 3. Seed core module entities
pnpm --filter mms-backend exec tsx src/scripts/seed-20-contacts.ts
pnpm --filter mms-backend exec tsx src/scripts/seed-20-faculty.ts
pnpm --filter mms-backend exec tsx src/scripts/seed-faculty-setup.ts
pnpm --filter mms-backend exec tsx src/scripts/seed-20-students.ts
pnpm --filter mms-backend exec tsx src/scripts/seed-20-sessions.ts
pnpm --filter mms-backend exec tsx src/scripts/seed-20-invoices.ts
```

---

## 3. Best Practices for New Fixture Authors

1. **Deterministic Pseudorandomness:**
   - Seed fixture generators with deterministic sequences rather than unseeded `Math.random()`.
   - Never generate dynamic random UUIDs for primary records used in E2E assertions; use predictable IDs like `demo-student-001`.
2. **Tenant Scoping:**
   - Always associate seeded rows with the demo workspace (`ws-demo` or tenant context from `withTenant`).
   - Never insert records with null `workspaceId` on tenant-scoped tables.
3. **Audit Trail Considerations:**
   - When generating fixtures directly via database pools, bypass tamper-evident outbox queues for bulk speed, OR explicitly call `createCollectionAuditHelper` if testing audit compliance.
4. **Soft-Delete Alignment:**
   - Active fixtures must have `deleted_at: null`, `deleted_by: null`, `deleted_reason: null`, and `deleted_with_cascade: false`.
