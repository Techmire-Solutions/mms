# Frontend standards review — 2026-09-24

This is an **advisory review reference**, not evidence that all runtime recommendations are implemented. Canonical rules own policy; skills explain application. Review scope is frontend-facing guidance and its examples, checked against the current workspace.

## Review coverage

| Area | Rules reviewed (frontend portions) | Skills reviewed |
|---|---|---|
| Structure, boundaries, tooling | Core, agent-universal, completion-review, structure-naming, DRY, dependencies | frontend, shared-package, dependency-upgrade, agent-standards |
| API, cache, sessions, permissions | API-interface, data-layer, auth-security, hooks | query-factories, data-sync, backend-security |
| Pages, directories, configuration | module-architecture, fields | module-page, module-work, module-setup, fields-registry, soft-delete |
| Forms, design and accessibility | form-architecture, UI-UX-design, performance | form-architecture, UI-UX-design, a11y-smoke |
| Localization | settings-i18n | settings-i18n, i18n-completeness |
| Reports, messaging and jobs | reports, messaging, module-architecture | reports-export, messaging, background-jobs, backup-restore |
| Verification and errors | testing-observability, completion-review | testing-e2e, code-review, error-triage |

Backend-only performance/security claims and production deployment procedures are outside this frontend review. Reading a referenced implementation does not certify the entire application.

## Corrections made

- Replaced fictional form/query/module/chart examples with small typed examples using real exports; removed the browser spec's invented host paths, locale query parameter and selectors. Actual `FormModal` props are `open`, `onSave`, `saving`, `saveDisabled`, and `error`.
- Documented draft identity/reset, preservation on refetch/save failure, and explicit `saveOnTabChange` behavior. Client Actions are distinct from unsupported RSC Server Actions.
- Corrected Query defaults to their source of truth, callback-composition guidance, placeholder scope, and logout/persistence review. Auth-gating a query does not erase cached data.
- Required advisory review of persisted tab selection against current permissions; hiding a tab does not guard its content or queries.
- Corrected portal versus native top-layer claims, HSL token syntax, Tailwind logical utilities, and optional CSS enhancement guidance. Avoid forcing a new overlay or theme architecture from a documentation example.
- Corrected WCAG criterion names/levels and separated the MMS 44px policy from AA's target-size criterion. Automated smoke is partial evidence.
- Clarified Effect Events, optimistic local state, controlled inputs, deferred rendering versus network debounce, containment risks, and financial optimism exclusions.
- Corrected Playwright workspace commands, actual frontend test tooling, test globs for TSX, date-only report filters, accessible chart alternatives and signed numeric exports.
- Corrected the i18n check description: the script reports counts but does not fail for missing translations. Corrected shared-package advice that incorrectly recommended Node built-ins in browser-shared code.
- Removed misleading blanket uniqueness bans from field guidance and blanket compliance-retention claims from reports.

## Follow-through during frontend implementation

1. **Session/cache boundary:** inspect `apps/frontend/src/lib/queryClient.ts`, `apps/frontend/src/lib/query/idbCachePersister.ts`, and `apps/frontend/src/lib/contexts/AuthContext.tsx`. Current tenant logout clears the in-memory client, but does not explicitly await persisted-cache removal; the persister uses a single record key within the origin and hydration starts at module initialization. Test rapid logout/reload, another user on the same tenant origin, expired sessions, offline hydration, revocation and pending persistence timers. Do not describe this as proven isolated without those tests. This review updates guidance; it does not fix the runtime persistence lifecycle.
2. **Permissions:** test a previously saved Reports/Setup tab after permission revocation, direct navigation, disabled module state and stale cache. Do not automatically treat the source page chosen as a layout reference as a complete security reference.
3. **Forms:** a rejected save retains draft and shows an actionable localized error; opening another record resets it intentionally; background refetch cannot silently replace dirty edits. Verify explicit save and tab-change behavior independently.
4. **Rendering:** measure expensive paths before memoization/containment changes. Test virtualized keyboard navigation, focus retention, stable keys, RTL, resized containers, long localized labels and print/export behavior. The >30-item convention is project guidance, not proof of a bottleneck.
5. **Browser security:** keep secrets out of `VITE_*`; retain the central cookie/CSRF/error pipeline. Treat imported text, URLs and rich content as untrusted. A hidden control does not replace server authorization.
6. **Verification:** use workspace Vitest for logic/state, Playwright for layout/focus, and existing axe smoke for automated accessibility findings. Happy-dom does not establish real layout, font shaping or assistive-technology behavior.

7. **Translation gate gap:** `scripts/i18n/check-translations.ts` logs missing/English-equal counts but sets no failing exit status for them. Inspect output and changed locale keys; a future blocking gate needs deliberate fallback/allowlist semantics and regression fixtures. No gate implementation changed in this review.

## Authoritative references checked

- [React Effect Events](https://react.dev/reference/react/useEffectEvent): call from Effects/Effect Events; do not use as general event handlers or to suppress legitimate dependencies.
- [React deferred values](https://react.dev/reference/react/useDeferredValue): deferred rendering does not itself prevent a request for each keystroke.
- [React optimistic state](https://react.dev/reference/react/useOptimistic): temporary state during an Action depends on the base value afterward; it does not undo external cache/server writes.
- [TanStack paginated queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries): previous data and `isPlaceholderData` are explicit pagination behaviors, not permission checks.
- [Verified UI sources and criteria](../../mms-ui-ux-design/references/modern-ui-ux-2026.md): WCAG, Tailwind utilities and native top-layer distinctions.

## Validation for this standards change

Run mirror sync and the repository integrity gate; compile the corrected TS/TSX examples against frontend dependencies. Check local links and diff whitespace. No runtime UI behavior changed, so do not imply that a new browser/a11y run occurred. Preserve existing changes from the preceding accounting task.
