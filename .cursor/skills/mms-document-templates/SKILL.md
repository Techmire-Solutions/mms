---
name: mms-document-templates
description: Implements MMS printable document templates end to end — server-authoritative layouts, compare-and-set saves with 409 conflict UX, the shared editor/renderer, and template-driven print surfaces for invoices, receipts, student cards, report cards, and Hasanat vouchers. Use when editing the template editor, documentTemplates contracts, template persistence hooks, or any module preview/print that consumes a stored layout. Do NOT use for SMS/WhatsApp message templates (use mms-messaging), generic create/edit forms (use mms-form-architecture), or analytics PDF/Excel exports (use mms-reports-export).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-11-02
allowed-tools: Read Grep Glob Write Edit Bash(pnpm *) Bash(node scripts/verify-rules-integrity.mjs) Bash(bash .agent/scripts/sync-all.sh)
---

# MMS Document Templates

**Rule (norms SSOT):** `mms-document-templates.mdc` (owner) · `mms-data-layer.mdc` §4 (Query authority) · `mms-api-interface.mdc` §6 (CAS/409) · `mms-dry.mdc` §1 (one renderer/print path) · `mms-settings-i18n.mdc` §4 (label catalogs) · `mms-testing-observability.mdc` §4 (test isolation).

## When to use

- Editing `TemplateEditor`, `DocumentTemplateEditor`, canvas/element rendering, history, or import/export.
- Changing the `documentTemplates` contract, repository, use case, or route.
- Changing `useDocumentTemplate`/save/conflict/cache behaviour.
- Adding or changing any module preview/print surface that consumes a stored template (invoice, fee receipt, student ID card, examination report card, Hasanat voucher).
- Adding template fields or presets that must appear in en/ar/ur/fa.

## Architecture map

| Layer | Location | Responsibility |
|---|---|---|
| Contract | `packages/shared/src/contracts/documentTemplates.contract.ts` | GET `{template, updatedAt}`; PUT `{template, expectedUpdatedAt}`; 409; layout schema |
| Server | `apps/backend/src/routes/tenant/templates/documentTemplatesContractRouter.ts` → `apps/backend/src/documents/use-cases/documentTemplatesUseCases.ts` → `apps/backend/src/db/repositories/documentTemplatesRepository.ts` | `settings.global.write` gate, conflict error, atomic CAS, audit/broadcast on success |
| Client data | `apps/frontend/src/lib/templates/documentTemplatesApi.ts`, `documentTemplateCache.ts`, `useDocumentTemplates.ts`, `useTemplateSaveConflict.ts` | record cache, save with cached version, typedd conflict, reload |
| Editor | `apps/frontend/src/components/app/DocumentTemplateEditor.tsx`, `apps/frontend/src/components/app/TemplateEditor.tsx`, `apps/frontend/src/components/template-editor/` | load/save/conflict, canvas, element renderer, import/export, localization |
| Module adapters | `apps/frontend/src/tenant/features/finance/components/FinanceTemplateEditor.tsx` (siblings: examinations, hasanat, obligations, accounting, students) | localized fields/presets, sample payload, default layout, module export adapters |
| Print | `apps/frontend/src/components/template-editor/TemplateDocumentPreview.tsx`, `templateDocumentPrint.ts` | one page renderer; popup print HTML |
| Guard | `apps/frontend/src/tenant/features/templateFieldI18n.test.ts` | every field/preset key exists |

## Procedure

### A. Wire a module document to print

1. Build a typed payload in the module `lib/*Payload.ts` (or reuse an existing mapper) — never build markup.
2. Resolve the module template key + default layout from its `lib/*TemplateData.ts`.
3. Render one offscreen 1:1 `TemplateDocumentPreview` as the print source; print with `printTemplateDocument` and surface `false` via `notify.error`.
4. Add the action to the module surface (row action/modal/footer); keep it read-only and module-gated.
5. Test: payload mapper unit test + print writes the expected fields/rows (mock `window.open`).

### B. Change persistence or concurrency

1. Update the contract first (`expectedUpdatedAt` nullable; 409 response; `updatedAt` string in 200).
2. Keep the repository atomic: insert `onConflictDoNothing`, update `WHERE updated_at = expected`, return `null` on no row; never read-then-write.
3. Throw a typed conflict (`statusCode 409`, `type: "conflict"`) from the use case; only audit/broadcast after success.
4. Client: send the cached `updatedAt`; on 409 keep draft/cache, block Save, show one toast + banner; reload refetches and remounts.
5. Test both route (null insert, matching version, stale 409, missing body 400) and hook (record cache, conflict leaves cache untouched, reload adopts record).

### C. Add or localize fields/presets

1. Extend the module data file; keep the key builder inline at the adapter call site:
   `localizeTemplateFields(FIELDS, keyForField, t)` with an inline template literal such as
   ``(field) => `finance.templateField.${field.field}` `` at the adapter call site.
2. Add `module.templateField.<field>` / `module.templatePreset.<key>` to en/ar/ur/fa; English values mirror the visible label.
3. Never use `t(key) || label` — a missing key returns the key, not `undefined`.
4. Run `templateFieldI18n.test.ts`, `check:i18n`, and the unused-key ratchet.

### D. Conflict UX

- Save hidden (`canSave=false`) and ⌘S guarded while blocked; banner offers “Reload latest (discards changes)”.
- One toast per conflict; generic save-failed toast is suppressed via `SilentTemplateSaveError`.
- Reload resets dirty state and remounts the editor with the refetched layout.

## Verification

```bash
pnpm --filter @mms/shared build
pnpm --filter mms-frontend typecheck && pnpm --filter mms-frontend lint
pnpm --filter mms-frontend exec vitest run src/components/template-editor src/lib/templates src/tenant/features/templateFieldI18n.test.ts
pnpm --filter mms-backend exec vitest run src/__tests__/documentTemplatesContractRoutes.test.ts src/__tests__/documentTemplatesUseCases.test.ts
pnpm check:i18n && node scripts/i18n/check-unused-keys.mjs
bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh
```

## Related skills

`mms-frontend`, `mms-backend-api`, `mms-query-factories`, `mms-shared-package`, `mms-settings-i18n`, `mms-testing-e2e`, `mms-code-review`.

## References

- `references/document-template-checklist.md` — review checklist for persistence, conflict UX, print and i18n.
- Existing print surfaces: `apps/frontend/src/tenant/features/finance/components/InvoiceReceiptModal.tsx`, `apps/frontend/src/tenant/features/examinations/components/StudentResultCard.tsx`, `apps/frontend/src/tenant/features/examinations/components/TermReportCardModal.tsx`, `apps/frontend/src/tenant/features/hasanat/components/DistributionDetail.tsx`.
- Known residuals: `docs/open-items.md` (template register).
