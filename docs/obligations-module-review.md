# Obligations Module — Whole-Module Review

Consolidated review after twelve facet audits. This document is the entry point: what the module is,
what state each layer is in, what the layers do *not* agree about, and what to do next.

**Status: healthy at the layer level, structurally saturated, and honest about a half-finished
product surface.**

---

## 1. What the module is

A **receipt ledger** for religious dues (khums/zakat and similar), not a pledge or installment model.

```
UI (111 files)                      packages/shared (7 files)            backend
ObligationsPage (3 tiers)  ──►  contracts/obligations.contract.ts        routes/tenant/obligations.ts
  Work: directory + drawer      obligationsModuleManifest.ts (schemas)    routes/.../obligations/*.ts
  Reports: ModuleReportsTier    obligationsReportAggregates.ts            obligations/use-cases/* (5)
  Setup: catalogue editors      obligationsEnums.ts                       obligations/domain/* (1)
  Receipt template (A6)         obligationsReceiptNumberingUtils.ts       db/repositories/obligation* (12)
                                money/moneySchemas.ts                     accounting/ledgerPosting/*
```

Six tables — `obligation_types`, `mujtahids`, `mujtahid_reps`, `wakala_types`,
`obligation_distributions`, `obligation_collections` — plus `obligation_module_preferences`. Every
receipt posts a double-entry journal (Dr cash/bank, Cr split rules) and every lifecycle transition
posts a reversal or repost.

---

## 2. Layer health

| Layer | State | Evidence |
|---|---|---|
| **Schema** | Solid | 0258 (FKs, 6 CHECKs, `version`, timestamptz) + 0259 (RLS policy dedup) applied and verified on a live database; composite FKs on every edge; 7 indexes on collections |
| **Persistence** | Solid | OCC (`version = excluded.version` + 409 `stale_write`), no-resurrection guard, restore provenance, hard-purge behind a GUC, audit rows in the same transaction |
| **Domain** | Solid | Wakala/split guards, cascade guard counting **receipts** as well as rules, catalogue replace guarded for all five vocabularies |
| **API** | Solid | 20 contract paths, all inject-covered; `responseValidation: true`; strict query schemas; 400/403/409/422 mapping; route-action rules |
| **Security** | Solid | `FORCE RLS` on all 7 tables with one policy each, proven as `NOBYPASSRLS`; route-level tenant scoping; hash-chained audit trail with atomic rollback |
| **Frontend** | Good | Three-tier shell, lazy modals, contract hooks with explicit staleTimes, complete invalidation, loading/empty/error states, RTL clean (logical properties only) |
| **Templates** | Good but narrow | One A6 receipt layout, 20 tokens with resolver parity, i18n labels in 4 locales, RTL pinned (canvas ↔ print) |
| **Import/Export** | Half | Export is real (paged, capped at 20k, formula-safe); **import has no runner** (503) |
| **Async** | None in-module | No jobs; the export runner is registered in the shared registry; the overdue/reminder pipeline is Finance's |
| **Tests** | Strong | 438 backend + 906 frontend + 27 DB + 6 RLS + 2 433 shared; 37 pinned invariants + 20/20 route injection; 20 of 29 module files directly referenced |
| **Docs** | Complete | 12 audits + a test matrix, all indexed |

---

## 3. Cross-layer findings (only visible when looking at the module whole)

| # | Sev | Finding |
|---|---|---|
| **M1** | **HIGH** | **Receipt numbers are generated in the browser from a truncated list.** `computeNextObligationReceiptNo(existingCollections)` takes `max(existing) + 1` from the *loaded* collections (≤ 2 000 rows). Past the cap, or with two clients saving at once, two receipts can be minted with the same number; the unique partial index then rejects the second with `409 conflict`. Correct data, poor experience — and the copy made it worse (M2). A server-side allocator is the fix (deferred in the schema audit as D3: the shared `generateNextObligationReceiptNo` alias exists but no server call site does). |
| **M2** | **HIGH** | **Two different 409s shared one message.** The conflict UX added in the write-path audit treated *any* 409 as a stale write, so a duplicate receipt number told the user "this receipt was changed by someone else — reopen it". **Fixed in this review**: `type === "stale_write"` refreshes and offers the current version; `type === "conflict"` names the duplicate number and asks for the next one (new label in 4 locales, pinned by a test). |
| **M3** | MEDIUM | **Structural saturation.** Five module files sit at 292–299 of the 300-line ceiling (`obligationCollectionsPersist` 299, `obligationsModuleManifest` 296, `obligationsUseCases` 294, `obligationWakalaRepository` 293, `obligationsCatalogUseCases` 292). Any next change in these files forces a split mid-task — the module has no head-room. |
| **M4** | MEDIUM | **One concept, three computations.** Dashboard metrics (`aggregateObligationsCommandMetrics`), report aggregates (`aggregateObligationsReport`) and the client summary (`useObligationsSummaryModel`) all total the same receipts. The Summary now uses the server aggregate for the unfiltered headline and the client sum when filtered — two numbers that can disagree past the 2 000-row cap. |
| **M5** | LOW | **Two bulk write semantics with confusable names.** The route upserts (`upsertObligationCollections`, `PUT /collections/bulk`); the restore/wipe mapping replaces (`replaceObligationCollectionsForWorkspace`, hard purge). The contract still calls the route `replaceCollections`, which is exactly the misreading that once had the client sending its whole directory (write-path audit F1). |
| **M6** | LOW | **Dead code.** `deleteObligationsByWorkspace` has no caller (the wipe uses the relational mapping), and its audit helper `auditObligationsPurged` is therefore unreachable; `postRestoredCollections`/`snapshotArchivedCollections`/`ObligationReceiptRef` are exported but used only inside their own files. |
| **M7** | — | **Cross-layer consistency is otherwise good:** one declaration site per type (frontend data module is a re-export shim), canonical enum tuples derive the zod schemas *and* the UI, DB CHECKs match them, and both the manual and scheduled paths resolve dates in the workspace zone. |

---

## 4. Risk register

| Risk | Likelihood | Impact | Mitigation now | Next |
|---|---|---|---|---|
| Duplicate receipt number on a large ledger | certain past 2 000 receipts | 409 on save, user retries | unique index + correct copy (M2 fixed) | server allocator (M1) |
| Next change hits the 300-line ceiling | high | CI failure mid-feature | ratchet catches it | pre-split the five files (M3) |
| Filtered totals disagree with the server | medium | misleading analytics | truncation notice + unfiltered server total | server-side filtered aggregates (API audit D1) |
| Import advertised but unavailable | certain | dead button | 503 is honest, blueprint is now correct | import runner (templates audit D2) |
| Receipt edits impossible in the UI | certain | backend OCC/ledger revision unreachable | documented | edit form with `version` (frontend D1) |
| Someone wires `deleteObligationsByWorkspace` into a wipe | low | double purge | documented in place | delete it (M6) |

---

## 5. Roadmap

**P0 — correctness/completeness of what users touch**
1. Server-side receipt-number allocation (M1) — removes the duplicate-save path entirely.
2. Receipt **edit** form carrying `version` — makes the OCC + ledger-revision path reachable.
3. The `obligations:import` runner — the module's only remaining 503 (blueprint is already correct).

**P1 — coherence**
4. Server-side filtered aggregates, then retire the client-side summary path (M4).
5. Rename `replaceCollections` → `upsertCollections` and the `replace*` repository helpers (M5).
6. Pre-split the five near-cap files (M3).

**P2 — polish**
7. Deletion-reason prompt in the trash action (the manifest already captures it).
8. `obligations.manage` permission for destructive catalogue edits.
9. Obligations E2E spec; DLQ replay UI; XLSX export; statement/demand/clearance templates (all need product decisions first).

---

## 6. Verification of this review

| Command | Result |
| --- | --- |
| Plan-item matrix across all thirteen plans | **44/44** present |
| `pnpm typecheck` | 6/6 |
| shared / backend / frontend suites | **2 433** / **438** / **906** |
| DB integration (6 suites, live PostgreSQL) | **27** |
| RLS as `NOBYPASSRLS` | **6/6**, role dropped, 0 leftover rows |
| `check:obligations-tests` / `check:obligations-route-injection` | 37 scenarios / **20/20** paths |
| 9 policy gates + 3 migration checks + i18n + prettier | pass |

The only behavioural change in this review is the two-409 split (M2); everything else is analysis.

---

## 7. The audits this consolidates

| Area | Document |
|---|---|
| Schema & persistence | [obligations-schema-persistence-audit-2026-11-14.md](./obligations-schema-persistence-audit-2026-11-14.md) |
| Domain & lifecycle | [obligations-domain-lifecycle-audit-2026-11-14.md](./obligations-domain-lifecycle-audit-2026-11-14.md) |
| Settlement, waivers, clearance (Finance) | [finance-settlement-waivers-clearance-audit-2026-11-14.md](./finance-settlement-waivers-clearance-audit-2026-11-14.md) |
| API layer & serialization | [obligations-api-serialization-audit-2026-11-14.md](./obligations-api-serialization-audit-2026-11-14.md) |
| Security, tenancy, audit | [obligations-security-tenancy-audit-2026-11-14.md](./obligations-security-tenancy-audit-2026-11-14.md) |
| Async workers & queues | [obligations-async-workers-audit-2026-11-14.md](./obligations-async-workers-audit-2026-11-14.md) |
| Templates, import, analytics | [obligations-templates-import-analytics-audit-2026-11-14.md](./obligations-templates-import-analytics-audit-2026-11-14.md) |
| Shared contracts & types | [obligations-shared-contracts-audit-2026-11-14.md](./obligations-shared-contracts-audit-2026-11-14.md) |
| Frontend & state | [obligations-frontend-audit-2026-11-14.md](./obligations-frontend-audit-2026-11-14.md) |
| Frontend write path | [obligations-frontend-write-path-audit-2026-11-14.md](./obligations-frontend-write-path-audit-2026-11-14.md) |
| Test suite | [obligations-test-suite-audit-2026-11-14.md](./obligations-test-suite-audit-2026-11-14.md) |
| Test suite (second pass) | [obligations-test-suite-audit-2-2026-11-14.md](./obligations-test-suite-audit-2-2026-11-14.md) |
| Pinned invariants | [obligations-test-matrix.md](./obligations-test-matrix.md) |
