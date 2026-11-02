---
description: Printable document-template engine — server-authoritative layouts, optimistic concurrency, shared editor/renderer/print path, and localized field catalogs
paths:
  - "apps/frontend/src/components/template-editor/**"
  - "apps/frontend/src/components/app/TemplateEditor.tsx"
  - "apps/frontend/src/components/app/DocumentTemplateEditor.tsx"
  - "apps/frontend/src/lib/templates/**"
  - "apps/frontend/src/lib/invoiceTemplate*.ts"
  - "apps/frontend/src/tenant/features/**/components/*TemplateEditor.tsx"
  - "apps/frontend/src/tenant/features/**/lib/*Template*.ts"
  - "apps/frontend/src/tenant/features/**/lib/reportCard*.ts"
  - "apps/backend/src/routes/tenant/templates/**"
  - "apps/backend/src/documents/**"
  - "packages/shared/src/contracts/documentTemplates.contract.ts"
  - "packages/shared/src/documents/**"
---

# MMS Document Templates

**Workflow skills:** `mms-document-templates` (editor, persistence, print) · `mms-frontend` (React/Query surface) · `mms-backend-api` (contract/routes) · `mms-settings-i18n` (field/preset catalogs).

**Scope:** printable layouts designed in the shared editor and printed by module screens — invoices, fee receipts, student cards, examination report cards and Hasanat vouchers. Messaging templates are plain-text campaign content and belong to `mms-messaging.md`; analytics/PDF exports belong to `mms-reports.md`.

**Ownership:** the editor engine lives in `apps/frontend/src/components/template-editor/`; server-backed hooks/API in `apps/frontend/src/lib/templates/`; the contract/schema in `packages/shared/src/contracts/documentTemplates.contract.ts` and `packages/shared/src/documents/`; the tenant route in `apps/backend/src/routes/tenant/templates/`; module adapters in `tenant/features/{module}/components/*TemplateEditor.tsx` with their data/presets/payloads in `lib/`. New printable module documents extend these layers — they do not add a second editor or print stack.

## 1. Persistence & Concurrency

- **Server-authoritative only.** Layouts are rows in `document_templates` behind `GET|PUT|DELETE /api/templates/:key`. `getObject`/`saveObject`, `db.ts`, `useLiveCollection` and direct localStorage writes are banned for layouts. The frontend cache (`documentTemplateCache`) is a read-through first-paint cache, never the source of truth.
- **Version echo.** GET returns `{ template, updatedAt }` (`updatedAt` may be `null` when no row exists). PUT sends `{ template, expectedUpdatedAt }`; `null` means insert-only.
- **Atomic compare-and-set.** The adapter inserts with `onConflictDoNothing` or updates with `WHERE updated_at = expected`; it never reads the row and writes in a second step. A zero-row result is a conflict, not a success.
- **409 conflict UX.** A conflict throws a typed error (409). The client keeps the draft and the stale cache entry, hides Save, shows one toast plus a persistent banner, and offers an explicit “Reload latest (discards changes)” action that refetches and remounts the editor. Silent overwrite and automatic retry are banned.
- **Authorization & audit.** Template writes require `settings.global.write`. Audit and live-broadcast events are emitted only after a successful write, inside the tenant transaction — never for a rejected save.
- **Rollout.** Contract changes that make `expectedUpdatedAt` mandatory require FE/BE to deploy together; old clients must fail closed with `400`, never fall back to an unchecked write.
- **Residuals.** `DELETE /api/templates/:key` is currently unversioned because no UI exposes it; any future destructive UI must send the same version token first. The token is the row's `updated_at` at JS `Date` millisecond precision — if a future writer uses SQL `now()`/microseconds, replace it with a dedicated integer version column rather than loosening the comparison.

## 2. Editor Contract

- **One engine.** `DocumentTemplateEditor` owns load, save, mutation state, conflict handling and toast policy. `TemplateEditor` owns canvas/selection/history/toolbars. Module adapters only supply:
  - `availableFields` (localized), `presets` (localized), sample payload, default template and storage key;
  - an optional import/export adapter (Typst/Zoho) and module-specific validation.
- **No per-module persistence.** Adapters must not call the template API directly, keep their own save hooks, or reimplement dirty tracking/conflict UI.
- **Schema-validated I/O.** Imported JSON is validated against `documentTemplateSchema`; ids are deduped; size/count caps align with the API body limit. Invalid imports fail visibly without mutating the draft.
- **Undo/redo and selection** remain bounded (history cap, state-machine behaviour) and must not be reset by re-renders. Preserve the reducer split when adding editor state.

## 3. Render & Print SSOT

- **One renderer.** Canvas and every print/preview surface render through `TemplateElementContent`; multi-page print preview uses `TemplateDocumentPreview`. Module screens must not hand-roll page markup, element positioning, QR codes or BiDi mirrors.
- **One print path.** Printing uses `buildTemplatePrintHtml` + `printTemplateDocument` (popup blocked ⇒ `false` ⇒ `notify.error`). Print CSS/page rules come from `printTemplateStyles` and the template’s `pageSize`/`orientation` — never a second `@page` stack.
- **Hidden print source.** Modal/list print surfaces render one offscreen 1:1 `TemplateDocumentPreview` as the print source; visible previews may scale but the offscreen copy stays unscaled.
- **Payload mapping.** Each module builds a typed payload (`lib/*Payload.ts`) and binds template fields to it. Print must consume the stored layout; a parallel hardcoded document for the same entity is a bug.
- **RTL.** Pass the locale direction to the preview and print document; rely on element-level script auto-detection rather than forcing direction per block.

## 4. Localization

- Every field and preset label resolves through `templateLocalization` and a module key prefix: `finance.templateField.*` / `finance.templatePreset.*`, `examinations.*`, `hasanat.*`, `students.cardTemplate.field.*`. No hardcoded English labels in adapters/data files.
- The key builder must remain visible as an inline template literal at the call site so the unused-translation ratchet sees the static prefix.
- A guard test (`apps/frontend/src/tenant/features/templateFieldI18n.test.ts`) asserts every derived field/preset key exists in the English pack; `pnpm check:i18n` proves ar/ur/fa parity.
- Never display a raw key or an English fallback when a locale is active (`t(key) || label` does not work: a missing key returns the key, not `undefined`).

## 5. Verification

```bash
pnpm --filter @mms/shared build
pnpm --filter mms-frontend typecheck && pnpm --filter mms-frontend lint
pnpm --filter mms-frontend exec vitest run src/components/template-editor src/lib/templates src/tenant/features/templateFieldI18n.test.ts
pnpm --filter mms-backend exec vitest run src/__tests__/documentTemplatesContractRoutes.test.ts src/__tests__/documentTemplatesUseCases.test.ts
pnpm check:i18n && node scripts/i18n/check-unused-keys.mjs
```

## 6. Banned Patterns

- Local-only layouts, legacy document-store writes, or a cache treated as persistence.
- Read-then-write version checks, silent overwrite, auto-retry after 409, or hiding conflicts behind a generic toast.
- A second editor, renderer, print window builder, or per-module receipt/report-card component that duplicates the shared stack.
- Hardcoded field/preset labels or `t(key) || "English"` fallbacks.
- Swallowing save/popup failures without user feedback or logging.
