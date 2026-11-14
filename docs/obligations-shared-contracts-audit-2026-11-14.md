# Obligations Shared Contracts & Type Audit (`packages/shared`)

Review of the shared DTOs, enums and runtime schemas behind the Obligations module.

**Status: reviewed and corrected.** Two real defects were found — closed vocabularies duplicated in the frontend, and the last date field still validated only by Postgres — plus one ratchet blind spot that had hidden a float parse in a money path. Centralization itself was confirmed.

---

## 0. Scope correction

Four briefed payload families **do not exist**:

| Briefed | Reality |
|---|---|
| Installment schedules | No installment entity anywhere in the repo. |
| Settlement allocation requests | Finance domain (`finance_payment_allocations`); obligations has no allocation request. |
| Waiver models | Finance credit notes; no obligations waiver. |
| Aging summary interfaces | No `due_date`/`status` domain, so nothing to age. |

What exists is one surface: the catalog + receipt schemas, the report aggregates, the ts-rest contract, the transfer/import/export DTOs, and the money helpers.

---

## Findings

### S — Shared DTOs & duplication

| # | Sev | Finding | Status |
|---|---|---|---|
| **S1** | — *(verified good)* | **One declaration site.** Every obligation type is a `z.infer` in `obligationsModuleManifest.ts` / `obligationsReportAggregates.ts`. The frontend's `lib/data/obligationsData.ts` is a **re-export shim**; there is no local `interface ObligationCollection` in `apps/`. One barrel path (`entry/indexDomainsOperations.ts`). Record, insert and update schemas are all `.strict()`. | Verified |
| **S2** | **MEDIUM** | **Enum values were declared twice.** `obligationsData.ts` carried local `as const` tuples (`PAYMENT_MODES`, `DISTRIBUTION_TYPES`, `DESIGNATED_FOR_OPTIONS`) duplicating the zod literals in shared, with nothing tying them: a new payment mode in the DTO left the UI's dropdown and validation stale and no test failed. | **Fixed** |
| **S3** | **MEDIUM** | **`received_date` was not a date in the write DTOs.** Record/insert declared `z.string().min(1)`, so `"not-a-date"` travelled to Postgres and came back as a generic `400 invalid_value` ("rejected by a data constraint") instead of naming the field. Report filters (plan 5) and the import blueprint (plan 8) had both been tightened; the **write path** was the leftover. | **Fixed** |
| **S4** | LOW | `version` is optional on record **and** insert, so the type cannot express "this save carries its OCC token"; the repository falls back to last-write-wins when any bulk row omits it. Deliberate legacy behaviour, now pinned by a test. | Documented (D2) |
| **S5** | LOW | **Money-safety ratchet blind spot.** The scan covered `apps/frontend/src/lib/data` but not `apps/frontend/src/lib`, where `invoiceTemplateResolver.ts` did `Number(collection.amount)` twice to format the printed receipt. Widening the scan also surfaced a pre-existing `parseFloat` in `apiColumnPreferencesSanitizer.ts` (a column *order*, not money). | **Fixed** |
| **S6** | LOW | `percentage: val === "" ? ("" as unknown as number) : num` in two distribution inputs — an impossible type used to model a blank draft. | Recorded (D3) |

### C — Consistency with the database

| # | Sev | Finding | Status |
|---|---|---|---|
| **C1** | — *(verified good)* | The shared vocabularies match the Drizzle CHECK constraints: `payment_mode` `Cash\|Online` ↔ `obligation_collections_payment_mode_chk`; distribution `type` `Income\|Liability` ↔ `obligation_distributions_type_chk`; amounts are exact integer cents (`moneyNumberAmountSchema`) against `numeric(12,2)`, asserted by `financeEnumParityDb`. Now also asserted behaviourally (a foreign mode and a malformed date are refused by the database). | Verified + pinned |
| **C2** | — *(note)* | The brief asks for "fixed-point stringified decimals". The module's convention is the opposite — a **number** at the DTO boundary with an exact-cents bound; decimal strings exist only in the import/export layer. That inversion is the schema audit's deferred D1, not a defect introduced here. | Documented |
| **C3** | — *(note)* | No client-server version drift mechanism exists beyond the `version` token; response validation (plan 5) is what catches a payload drift at runtime. | Verified |

---

## 1. What was applied

### 1.1 Canonical enum tuples (S2)

New `packages/shared/src/obligations/obligationsEnums.ts` holds the three tuples and derives `obligationPaymentModeSchema` / `obligationDistributionTypeSchema` / `obligationDesignatedForSchema` from them. The manifest's six inline `z.enum([...])` literals are replaced by those schemas (wire-identical), the enums are exported through the operations barrel, and `obligationsData.ts` now **re-exports** the tuples under its existing names — so no consumer changed, but there is now one source.

### 1.2 Date validation on the write path (S3)

`received_date: isoDateSchema` on `obligationCollectionRecordSchema` and `obligationCollectionInsertSchema` (the update schema is `.partial()`, so it inherits). A malformed value, an impossible calendar date (`2026-02-30`) and a full ISO **datetime** are rejected at the edge — the datetime deliberately, because the column stores a date and the client already sends one.

### 1.3 Exact money coercion for the printed receipt (S5)

- `toMoneyNumber(value)` in `moneySchemas.ts`: takes a finite number or a ≤2-dp decimal string, parses the digits into integer cents (`Number.parseInt`, no float parse), and returns `null` for `""`, `"abc"`, `"1.005"`, `NaN`, `Infinity`, or cents beyond 2^53. Display-only by contract.
- `invoiceTemplateResolver.ts` uses it for the amount and amount-in-words tokens, so a partial draft renders blank instead of `NaN`.
- `check-money-safety` now scans `apps/frontend/src/lib` (10 roots); the column-preference `parseFloat` became `Number(String(raw).trim())`, which is stricter (`"3abc"` no longer becomes `3`) and needs no exemption.

---

## 2. Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @mms/shared test` | **2 433** tests / 294 files (incl. 13 new schema tests, 8 new `toMoneyNumber` tests) |
| `pnpm typecheck` | 6/6 packages |
| backend obligations + finance | **296** tests / 39 files |
| `obligationsPersistenceDb` (live database) | **8/8**, incl. a foreign `payment_mode` and a malformed date refused by the database |
| frontend obligations + `src/lib` | **820** tests / 157 files |
| `check-money-safety` | passes with the widened scan |
| `check-code-norms` · `check-shared-structure` · `check-docs` · `check:i18n` | held |

## 3. Deferred

| ID | Item |
|---|---|
| **D1** | Move receipt money from a `number` to a fixed-point **decimal string** end-to-end (the brief's literal ask; it inverts the module's convention and touches forms, DTOs, repositories and the ledger). |
| **D2** | Make the OCC token required on a new schema version, once the legacy last-write-wins callers are migrated. |
| **D3** | A typed percentage draft (`number \| ""`) so the two `as unknown as number` casts disappear. |
| **D4** | The four absent payload families — they belong to domains this module does not have. |

## 4. Assumptions

1. Deriving `z.enum(TUPLE)` from a tuple is wire-identical to the previous inline literal; only the declaration site moved, so no API version bump is needed.
2. Rejecting a full ISO datetime in `received_date` is correct: the column is a `date` and the client already sends the date-only form.
3. `toMoneyNumber` is display-only; persistence keeps the exact decimal string or integer cents.
4. A `dist` rebuild is required before the backend/frontend observe a shared-schema change (this was verified: the schema tests run on `src`, the apps on `dist`).
