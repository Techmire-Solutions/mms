# Document Template Review Checklist

Use before accepting any change that touches the editor, template persistence, or a print surface.

## Persistence

- [ ] Layouts are read/written only through `/api/templates/:key` (no `getObject`/`saveObject`, no localStorage layout writes).
- [ ] GET result is treated as `{ template, updatedAt }`; cache is read-through only.
- [ ] PUT sends the cached `expectedUpdatedAt` (`null` for first insert).
- [ ] Repository CAS is atomic (insert `onConflictDoNothing` or update `WHERE updated_at = expected`); no read-then-write.
- [ ] Stale version ⇒ typed 409; audit/broadcast only after a successful write.
- [ ] Write path requires `settings.global.write`.

## Conflict UX

- [ ] 409 keeps the draft and the stale cache; Save is hidden/disabled and ⌘S guarded.
- [ ] Exactly one conflict toast + persistent banner; no generic “save failed” duplicate.
- [ ] Reload action refetches, remounts, and discards the draft explicitly.
- [ ] No auto-retry or silent overwrite.

## Editor / render / print

- [ ] Editor loads via `useDocumentTemplate` and saves via `DocumentTemplateEditor`; adapter has no own persistence.
- [ ] Canvas and print render through `TemplateElementContent` / `TemplateDocumentPreview`.
- [ ] Print uses `printTemplateDocument`; popup blocked is surfaced to the user.
- [ ] Page size/orientation comes from the stored template, not a second `@page` stack.
- [ ] Offscreen print copy is 1:1; any visible preview scaling does not affect print.
- [ ] Payload mapper is typed; print consumes the stored layout, not parallel markup.

## Localization

- [ ] Every field/preset label resolves through `templateLocalization` + a module prefix.
- [ ] Keys exist in en/ar/ur/fa; `templateFieldI18n.test.ts` and `check:i18n` pass.
- [ ] No raw key or English fallback renders in a non-English locale.

## Tests

- [ ] Component tests are wrapped in `withQueryClient`.
- [ ] Print tests stub `window.open` and assert the written HTML rows/fields.
- [ ] Route tests cover insert, matching version, stale 409, and missing/invalid body.
- [ ] Hook tests cover cache record, successful save, conflict (cache untouched), and reload.
