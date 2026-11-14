# Obligations Test Matrix

Invariants that must keep a pinning spec. `scripts/check-obligations-test-matrix.mjs` fails CI when
a listed file disappears or a listed `it()` name is gone, so a rename or a refactor cannot silently
drop a scenario.

| Invariant | Spec | Pinned scenario |
|---|---|---|
| OCC rejects a stale token | `db-integration/obligationsPersistenceDb` | rejects a save carrying a stale version instead of overwriting the winner |
| OCC arbitrates a real race | `db-integration/obligationsConcurrencyDb` | lets exactly one of two same-version saves win and rejects the other with 409 |
| Row lock re-checks the predicate | `db-integration/obligationsConcurrencyDb` | serializes on the row lock and re-checks the version predicate |
| Single-vs-bulk race | `db-integration/obligationsConcurrencyDb` | arbitrates a race between the single save and the bulk save |
| Audit append is atomic with the write | `db-integration/obligationsAuditAtomicityDb` | rolls the receipt write back when the audit append fails |
| Catalogue cascade guard counts receipts | `db-integration/obligationsCascadeDb` | refuses an obligation-type replace that would cascade the receipt away |
| Sender edge is RESTRICT | `db-integration/obligationsCascadeDb` | refuses to hard-delete a contact that a receipt still references |
| RLS isolation | `rls/obligationsTenantIsolation` | returns only the current tenant's rows for an unfiltered read |
| One RLS policy per table | `rls/obligationsTenantIsolation` | has exactly one policy per obligation table, all FORCE-enabled |
| Route-level tenant scoping | `obligationsCrossTenant.integration` | keeps another workspace's receipt id inside the caller's own scope |
| Split largest-remainder | `packages/shared/src/finance/obligationSplitAllocation` | gives the leftover cent to the largest remainder, stably |
| Blueprint validation | `packages/shared/src/__tests__/obligationsImportBlueprint` | rejects the old tasks shape instead of silently carrying it |
| Receipt date validation | `packages/shared/src/__tests__/obligationsSharedSchemas` | rejects %s before it reaches the database |
| Single-record save payload | `hooks/useObligationsPageActions` | sends exactly one record, not the cached directory |
| Catalogue lists are inject-covered | `obligationsCatalogRoutes.integration` | serves a reader and scopes the read to the caller's workspace |
| Catalogue writes refuse a read-only role | `obligationsCatalogRoutes.integration` | refuses a read-only role before the save runs |
| Preferences need the setup privilege | `obligationsCatalogRoutes.integration` | refuses a writer without the setup privilege |
| Two catalogue replaces never interleave | `db-integration/obligationsCatalogueConcurrencyDb` | leaves one caller's whole set, never a mixture |
| A failed catalogue replace leaves the old set | `db-integration/obligationsCatalogueConcurrencyDb` | rolls the previous aggregate back when a replace fails |

## Adding a row

Add the invariant and its `it()` name to both this table and `REQUIRED` in
`scripts/check-obligations-test-matrix.mjs`. The check asserts the string appears in the file — name
the scenario the same way in both places.
