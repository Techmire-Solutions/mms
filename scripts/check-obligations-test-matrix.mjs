#!/usr/bin/env node
/**
 * Obligations test-matrix ratchet.
 *
 * Fails when a required invariant loses its pinning spec — a renamed `it()`, a deleted suite, or a
 * refactor that quietly drops a scenario. The matrix itself lives in
 * docs/obligations-test-matrix.md; this script enforces the rows that exist today.
 *
 * Modelled on scripts/check-examinations-test-matrix.mjs: file + literal scenario names.
 */
import { readFileSync } from "node:fs";

const REQUIRED = [
  {
    file: "apps/backend/src/__tests__/db-integration/obligationsPersistenceDb.integration.test.ts",
    names: [
      "rejects a save carrying a stale version instead of overwriting the winner",
      "refuses to clear deleted_at through a bulk save (no silent resurrection)",
    ],
  },
  {
    file: "apps/backend/src/__tests__/db-integration/obligationsConcurrencyDb.integration.test.ts",
    names: [
      "lets exactly one of two same-version saves win and rejects the other with 409",
      "refuses a blind overwrite with a token that is one behind",
      "serializes on the row lock and re-checks the version predicate",
      "arbitrates a race between the single save and the bulk save",
    ],
  },
  {
    file: "apps/backend/src/__tests__/db-integration/obligationsAuditAtomicityDb.integration.test.ts",
    names: [
      "rolls the receipt write back when the audit append fails",
      "commits exactly one CREATE audit row with the receipt",
    ],
  },
  {
    file: "apps/backend/src/__tests__/db-integration/obligationsCascadeDb.integration.test.ts",
    names: [
      "keeps the receipt when the contributing contact is archived",
      "refuses to hard-delete a contact that a receipt still references",
      "pins the FK delete actions: sender RESTRICT, representative/type CASCADE",
      "counts a receipt as a cascade dependent of its representative",
      "counts a receipt as a cascade dependent of its obligation type",
      "refuses a representative replace that would cascade the receipt away",
      "refuses an obligation-type replace that would cascade the receipt away",
    ],
  },
  {
    file: "apps/backend/src/__tests__/rls/obligationsTenantIsolation.db.integration.test.ts",
    names: [
      "returns only the current tenant's rows for an unfiltered read",
      "cannot read another tenant's receipt even with an explicit id",
      "cannot update or delete another tenant's rows",
      "has exactly one policy per obligation table, all FORCE-enabled",
    ],
  },
  {
    file: "apps/backend/src/__tests__/obligationsCrossTenant.integration.test.ts",
    names: [
      "scopes the collection list to the token's workspace",
      "keeps another workspace's receipt id inside the caller's own scope",
      "audits a delete against the caller's workspace, never the receipt's",
      "rejects a token whose workspace disagrees with the request host before any handler runs",
    ],
  },
  {
    file: "apps/backend/src/__tests__/obligationsCatalogRoutes.integration.test.ts",
    names: [
      "serves a reader and scopes the read to the caller's workspace",
      "refuses a read-only role before the save runs",
      "refuses a writer without the setup privilege",
      "rejects a malformed body with 400 before any save",
    ],
  },
  {
    file: "apps/backend/src/__tests__/db-integration/obligationsCatalogueConcurrencyDb.integration.test.ts",
    names: [
      "leaves one caller's whole set, never a mixture",
      "never leaves an orphaned distribution behind",
      "rolls the previous aggregate back when a replace fails",
    ],
  },
  {
    file: "packages/shared/src/finance/obligationSplitAllocation.test.ts",
    names: ["gives the leftover cent to the largest remainder, stably"],
  },
  {
    file: "packages/shared/src/__tests__/obligationsImportBlueprint.test.ts",
    names: ["rejects the old tasks shape instead of silently carrying it"],
  },
  {
    file: "packages/shared/src/__tests__/obligationsSharedSchemas.test.ts",
    names: ["keeps the DTOs on the canonical schemas"],
  },
  {
    file: "apps/backend/src/__tests__/obligationDomainGuards.test.ts",
    names: ["refuses the delete and reports what would cascade"],
  },
  {
    file: "apps/frontend/src/tenant/features/obligations/hooks/useObligationsPageActions.test.tsx",
    names: ["sends exactly one record, not the cached directory"],
  },
  {
    file: "apps/frontend/src/tenant/features/obligations/hooks/invalidateObligationsQueries.test.ts",
    names: ["invalidates every declared obligation cache"],
  },
  {
    file: "apps/frontend/src/tenant/features/obligations/lib/obligationsSummaryCalculations.test.ts",
    names: ["sums 2-dp amounts without float drift"],
  },
];

let missing = 0;
for (const { file, names } of REQUIRED) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    console.error(`✗ required obligations spec is missing: ${file}`);
    missing += 1;
    continue;
  }
  for (const name of names) {
    if (!source.includes(name)) {
      console.error(`✗ ${file} is missing the required scenario: "${name}"`);
      missing += 1;
    }
  }
}

if (missing > 0) {
  console.error(`💥 ${missing} obligations test-matrix requirement(s) missing.`);
  process.exit(1);
}
const total = REQUIRED.reduce((count, row) => count + row.names.length, 0);
console.log(`✓ Obligations test matrix: ${total} required scenarios present.`);
