# Obligations Frontend & State Management Audit

Review of the page architecture, forms, analytics rendering and TanStack Query layer for the Obligations module.

**Status: reviewed and corrected.** Two cache-correctness bugs are fixed (stale report aggregates, an unreachable voucher cache), the analytics path now shows the server's exact total, the two tiers gained loading states, and a float summation in the summary model was replaced with the module's integer-cents rule.

---

## 0. Scope correction

| Briefed | Reality |
|---|---|
| `TemplateModulePage`, `TemplateFormModal`, `ModuleReportCharts.tsx` | No such files. The page is the standard three-tier `ObligationsPage` (`ObligationsWorkTier` / shared `ModuleReportsTier` / `ObligationsSetupTier`, each lazy with `Suspense`); forms use the shared `FormModal`; charts are `ReportChartCard` + the summary model. |
| Installment schedule breakdowns, contact/student obligation ledger drawers | No installment entity, no ledger drawer. The detail surface is `ObligationCollectionDetail` (lazy modal) plus a voucher modal. |
| Waiver request / payment allocation modals, balance remaining, over-allocation | No waiver, no allocation, no running balance in this module. The only split UI is the wakala distribution editor, which **does** block >100 % live (`useWakalaTypeManager`) and is server-guarded by `assertSplitRulesComplete`. |
| Dashboard **aging** widgets | No aging domain; the module feeds the shared command-metrics KPI cards. |

---

## Findings

### C — Cache correctness

| # | Sev | Finding | Status |
|---|---|---|---|
| **F1** | **HIGH** | **Report aggregates were never invalidated.** `createModuleQueryInvalidator` supports a `reports` key and documents why ("dashboards keep a long staleTime, so they must be listed"); question-bank passes it. `invalidateObligationsQueries` omitted it while `useObligationsReportAggregates` runs with **`staleTime: 5 min`** — so recording, editing, archiving or bulk-replacing a receipt left the Summary tab stale for up to five minutes. No test covered the invalidator. | **Fixed** + coverage test |
| **F2** | MEDIUM | **The voucher query sat outside the key hierarchy.** `["obligation-voucher", id]` (`staleTime: 30 s`) could never be reached by a `["obligations", …]` prefix invalidation, so an edit that reverses and reposts the journal still showed the pre-edit voucher on reopen. | **Fixed** |

### S — Summary data flow

| # | Sev | Finding | Status |
|---|---|---|---|
| **F3** | MEDIUM | **The server aggregate was fetched and never rendered.** The Summary queried `reportAggregates` only to feed `isError`/`refetch`; the KPI cards came from the client-side list, which is capped at `OBLIGATIONS_COLLECTIONS_MAX_LIMIT` (2 000) — so a large workspace could show a silently under-counted headline while the exact number sat unused in the same component. | **Fixed** |
| **F4** | LOW | An aggregates failure blanked the whole Summary, even though every chart on it is client-side. | **Fixed** (degrades to the client total + a notice) |
| **F5** | MEDIUM | **No loading state in either tier.** Errors had `ErrorState`, but `isLoading` was never consulted: an empty table and zeroed KPIs rendered during the first fetch. The only skeleton was the lazy chart chunk's `Suspense` fallback. | **Fixed** |
| **F6** | LOW | **Double-submit guard was local state.** `setSubmitting(true)` applies on the next render, so two synchronous submits both passed `!submitting`. | **Fixed** (in-flight ref) |
| **F7** | MEDIUM | **A float money sum in the summary model.** `filtered.reduce((sum, c) => sum + c.amount, 0)` accumulated floats while every other total in the module (and the printed receipt) works in integer cents — two summation styles that can disagree by fractions of a paisa, and the headline then feeds percentage breakdowns. | **Fixed** |
| **F8** | — *(verified good)* | **BiDi/RTL is clean.** A physical-property scan (`text-left`, `ml-`, `pr-`, `left-`, …) across the feature returns two hits, both a test fixture id (`"mr-1"`). The printable receipt's RTL is pinned separately by `templateRenderParity.test.tsx`. | Verified |
| **F9** | — *(verified good)* | **State separation is sound.** `ObligationsModalLayer` owns modal identity and lazy-loads form/detail/voucher; the page controller owns tier state; hooks are contract-based with explicit `staleTime`s and (after F2) prefix-compatible keys. | Verified |

---

## 1. What was applied

### 1.1 Invalidation completeness (F1, F2)

- `invalidateObligationsQueries` now passes `reports: OBLIGATIONS_REPORT_AGGREGATES_QUERY_KEY` and `lookups: OBLIGATIONS_VOUCHER_QUERY_KEY`.
- The voucher moved to `OBLIGATIONS_VOUCHER_QUERY_KEY = ["obligations", "voucher"]`, and `obligationsQueryKeys.ts` now exports `OBLIGATIONS_QUERY_KEYS` — the full declared key set.
- New `invalidateObligationsQueries.test.ts` drives a real `QueryClient`, seeds one entry per declared key (plus a contract sub-key), runs the invalidator, and asserts **every** key is invalidated. A future key added without invalidation fails there instead of going stale in production.

### 1.2 The Summary shows the number it fetches (F3, F4)

- With no client filter active, the two headline KPI cards read `aggregatesQuery.data` — the exact, uncapped, server-side figure — falling back to the client sum while loading or on failure.
- A truncation notice appears when the list is at the 2 000-row cap **and** a filter is active, so a client-side filtered total is labelled rather than presented as exact.
- The aggregates query is no longer part of the fatal error set: its failure keeps the charts and adds an inline notice.

### 1.3 Loading states (F5)

- The controller exposes `listLoading`; `ObligationsWorkTier` renders a skeleton list (aria-busy) instead of an empty directory.
- `ObligationsSummary` renders four skeleton KPI cards while the collections query loads.
- Two new i18n keys (`obligations.summary.truncated`, `obligations.summary.aggregatesUnavailable`) added in en/ar/ur/fa.

### 1.4 Integer-cents total and the submit lock (F6, F7)

- `sumAmounts(values)` in `obligationsSummaryCalculations.ts` sums in integer cents (skipping non-finite values); the summary model uses it instead of the float `reduce`.
- `ObligationCollectionForm` gained an `inFlightRef` so a second synchronous submit is ignored regardless of render timing.

---

## 2. Verification

| Command | Result |
| --- | --- |
| `pnpm typecheck` | 6/6 packages |
| `pnpm --filter @mms/shared test` | 2 433 tests (i18n parity holds with the two new keys in all four locales) |
| frontend obligations suites | `invalidateObligationsQueries` **3**, `ObligationsWorkTier` **3**, `obligationsSummaryCalculations` **4**, plus the existing receipt/template suites |
| `check:i18n` · `check-code-norms` · `check-docs` · `check-work-directory` | held |

**Not covered by an automated test:** the double-submit ref (F6). Rendering `ObligationCollectionForm` requires ~10 mocked lookups and the catalog quick-create hook; the lock is a two-line ref guard reviewed by hand. It is called out here rather than claimed as tested.

## 3. Deferred

| ID | Item |
|---|---|
| **D1** | Move the **filtered** totals and charts onto server aggregates (the endpoint already takes type/rep/date filters), removing the client truncation window entirely. |
| **D2** | Tailored empty-state copy per tier, if the shared table/cards defaults prove too generic. |
| **D3** | The briefed installment builder / waiver request / ledger drawer surfaces — they need domains this module does not have. |
| **D4** | Multi-invoice settlement allocation UX lives in Finance (`financePaymentAllocations`), not here. |

## 4. Assumptions

1. `invalidateQueries` is prefix-based; the new coverage test pins that rather than trusting it.
2. The server aggregate is the correct unfiltered headline; the client sum remains authoritative only for filtered views until D1.
3. Invalidating two extra keys on mutation success cannot cause a request storm — they are refetched only when their components are mounted.
4. Skeletons reuse the existing `Skeleton` primitive; no new dependency.
