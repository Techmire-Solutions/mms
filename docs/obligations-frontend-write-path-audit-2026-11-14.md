# Obligations Frontend — Write-Path Audit (Second Pass)

Follow-up to [obligations-frontend-audit-2026-11-14.md](./obligations-frontend-audit-2026-11-14.md), covering the same brief. The previous pass closed the cache/invalidation, loading and float-money findings; this pass audits what the client actually **sends** and what it does when the write is **rejected** — which the earlier reviews missed because they read the endpoint rather than the caller.

**Status: reviewed and corrected.** One HIGH write-path defect, one latent data-loss hazard, one missing conflict UX and one inconsistent empty state are fixed.

---

## 1. Re-verification of the previous pass

| Fix | State |
|---|---|
| `reports:` + voucher invalidation, QueryClient coverage test | present |
| Server-exact unfiltered headline, truncation/degrade notices | present |
| Work/Summary skeletons | present |
| In-flight submit ref | present |
| `sumAmounts` integer-cents total | present |

Also corrected from last time: the Work directory **does** already have differentiated empty states (`ObligationCollectionsListContent` → `obligations.empty.collectionsTitle` / `collectionsFiltered`), so the "empty states" half of the brief's item 1 needed no work.

---

## Findings

| # | Sev | Finding | Status |
|---|---|---|---|
| **F1** | **HIGH** | **Creating one receipt sent the client's whole directory.** `handleSaveCollection` called `replaceCollections.mutateAsync([...collections])` — the cached list, up to the 2 000-row cap — for a single new row. The live route upserts and its upsert set bumps `version = version + 1` for **every** row in the payload, so one create made every other receipt stale and **any other session's next save got a spurious `409 stale_write`**. It also shipped a 2 000-row JSON body per create. | **Fixed** |
| **F1b** | **HIGH (latent)** | The same call was one refactor from **data loss**: the contract is named `replaceCollections`, and this repo's own replace implementation (`replaceObligationCollectionsForWorkspace`) sets `app.allow_hard_purge`, `DELETE`s every workspace row and re-inserts the payload. A true-replace handler would have permanently destroyed every receipt beyond the cap. | **Fixed** (one-record payload + documented upsert semantics) |
| **F2** | MEDIUM | **A stale-write conflict had no actionable UX**: a 409 showed the generic "save failed" toast, the list was not refreshed, and the user could not see what changed. `isConflictError` existed and was unused here. | **Fixed** |
| **F3** | LOW | **Charts vanished on an empty filter** (`return null`) while the rep-dues section below explained the same condition with an `EmptyState`. | **Fixed** |
| **F4** | LOW | The contract named `replaceCollections` never said the endpoint **upserts** — the ambiguity that made F1's payload look safe. | **Fixed** (contract summary) |
| **F5** | — *(capability)* | **Receipts are create-only in the UI.** The form is always "new collection" and `ObligationCollectionFormState` has no `version`, so the backend's OCC-protected edit path (with its ledger revision) is unreachable from the client; the `existingCollection` branch in the save handler was dead code. | Recorded (D1) |
| **F6** | — *(verified good)* | State separation, RTL/logical properties, integer-cents totals and the module-level invalidation contract all hold (see the previous report). | Verified |

---

## 2. What was applied

### 2.1 One record per save (F1, F1b)

`handleSaveCollection` now sends `[collectionPayload]`. The upsert merges that row and touches nothing else, so no other receipt's version moves and the payload no longer scales with the directory. The list refresh still comes from the mutation's `onSuccess` invalidation.

The dead edit branch is replaced rather than kept, with a comment stating why the payload must never be the directory.

### 2.2 Actionable conflict (F2)

On `isConflictError(error)` the handler calls a new `refetchCollections` prop (wired from the controller's existing refetch) and notifies with `obligations.saveConflict` — "this receipt was changed by someone else; the list has been refreshed; reopen it" — in en/ar/ur/fa. Every other failure keeps the generic copy and the re-throw, so the modal stays open with the user's input.

### 2.3 Charts explain an empty result (F3)

`ObligationsSummaryChartsSection` renders the existing `EmptyState` (`obligations.summary.emptyFiltered`) instead of `null` when nothing matches — the same treatment the rep-dues section already had.

### 2.4 Contract honesty (F4)

`replaceCollections` carries a summary stating it **upserts** by `(workspace, id)` and never removes rows, plus the hazard note about the historical name.

---

## 3. Verification

| Test | Result |
| --- | --- |
| `useObligationsPageActions.test.tsx` (new, 3) | save sends **one** record (not the 3-row cached list); a failure keeps the modal open; a 409 refetches and uses the conflict copy |
| `ObligationsSummaryChartsSection.test.tsx` (new, 2) | zero rows → empty state; non-zero → charts |
| `pnpm typecheck` | 6/6 |
| frontend obligations + hooks | **159** tests / 40 files |
| `pnpm --filter @mms/shared test` | **2 433** tests (i18n parity with the new key in four locales) |
| `check:i18n` · `check-money-safety` · `check-code-norms` · `check-docs` · `check-work-directory` · `check-backend-boundaries` · `check-shared-structure` | held |

## 4. Deferred

| ID | Item |
|---|---|
| **D1** | A receipt **edit** form carrying `version`, so OCC and the ledger revision are exercised from the UI. Server-side support already exists. |
| **D2** | Rename the contract key (and the `replace*` repository helpers) to `upsert…`; deferred because it touches every consumer for no wire change. |
| **D3** | Server-side filtered analytics (previous report's D1). |
| **D4** | Installment builder, waiver request, allocation modals — no domain exists. |

## 5. Assumptions

1. One-record payloads are safe on the create path: the id is client-generated and the upsert is keyed by `(workspace_subdomain, id)`.
2. With the directory payload gone, a 409 can only mean a genuinely stale token, which is exactly when a refetch helps.
3. Reusing `obligations.summary.emptyFiltered` avoids a second near-duplicate string.
4. The `replace*ForWorkspace` repository functions are untouched — only the client stops calling the bulk endpoint with everything it has.
