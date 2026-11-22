# Students Shared UI/UX Best-Practice Review — 2026-11-22

Systematic UI/UX audit of the shared components the Students module consumes (and its local composites)
against the MMS modern best-practice checklist (BiDi logical CSS, 44px touch targets, focus-visible,
reduced-motion, semantic HTML, accessible names, `dir="auto"` on mixed-script content, i18n, virtualization,
live regions, dialog semantics). Method: a three-way fan-out over `packages/ui/src` primitives,
`apps/frontend/src/components/app/*` composites, and `apps/frontend/src/tenant/features/students/components`,
each reporting concrete `file:line` violations.

**Baseline already green (machine-enforced):** BiDi logical classes (4,260 files), raw-color ratchet,
i18n parity, shared-UI governance, focus-visible/reset tokens, and a global `prefers-reduced-motion` block
that gates animation/transition/scroll. The findings below are the residual, non-enforced gaps.

## 1. Applied (verified)

| Component | Fix | Category |
| --- | --- | --- |
| `StudentDetailSiblingsSection` | Replaced `focus:outline-none focus-visible:bg-muted/60` with a visible `focus-visible:ring-2 ring-ring` treatment on the row `<button>` | focus-visible (**high**) |
| `StudentDetailSiblingsSection`, `GuardianContactCard`, `ParentNamesSubtitle`, `StudentDetailContactChannels`, `StudentRelationshipCard`, `StudentRelationshipContactList` | Added `dir="auto"` to 7 user-entered name/phone/email elements (mixed-script bidi isolation) | dir-auto |
| `Card` (shared primitive) | `interactive` cards now activate on Enter/Space (previously `role="button" tabIndex={0}` with no keyboard handler) + regression spec | semantic-html |
| `Badge` (shared primitive) | A clickable badge now renders a real `<button>` (forced from `as="div"/"span"` when `onClick` is set) instead of a mouse-only `<div onClick>` | semantic-html |
| `PersonIdentityMeta` | Interactive gender / Syed filter badges now meet the 44px floor (`min-h-11 min-w-11`) | touch-target |
| `ModuleRowActionsMenu`, `EntityMessagingActions`, `StudentIdCardPrintControlsBar`, `StudentIdCardModal`, `StudentFormSectionShared` | 13 decorative lucide icons marked `aria-hidden` (they sit beside labelled text) | accessible-name |
| `Modal` (app) | Added an `ariaLabel` prop so an untitled dialog can still be named (`aria-label` when no `title`) | dialog |
| `EntityMessagingActions` | English `"Call"/"WhatsApp"/"SMS"/"Email"` fallbacks now resolve via `t()` (`common.call` + `messaging.channel.*`) | i18n |
| `StudentCardPrintPreview`, `StudentIdCardModal`, `StudentsListDesktopTable` | Dropped English fallbacks (`"Madrasa Management System"`, `"Seminary Road"`, `"Madrasa"`, `"Student"`) — branding/`t()`/empty instead | i18n |
| `DetailAttributeRow`, `DirectoryCardMetaTile` | String values now get `dir="auto"` (bidi isolation) while complex `ReactNode` values keep the surrounding direction | dir-auto |
| App provider tree | Wired `UiConfigProvider` into `AppProviders` with `t()` for `cancel`/`confirm`/`delete`/`close` (so `@shared/ui` `Modal`/`AlertDialog`/`Toast` close labels are localized) | i18n |
| `ConfirmAlertDialog` | Defaults now resolve through `useUiConfig().labels` instead of hardcoded `"Continue"/"Cancel"` | i18n |
| `Modal` (packages/ui) | Added `ariaLabel` prop for untitled dialogs | dialog |
| `Toast` / `ToastClose` | Close button `aria-label` now resolves via `useUiConfig().labels.close` | accessible-name / i18n |
| i18n | Added `common.confirm` to en/ar/ur/fa | i18n |
| `UiConfigLabels` + tenant bridge | Extended with `retry`/`searchPlaceholder`/`clearSearch`/`loading`; `Spinner`, `TableSkeleton`, `SearchBar`, `ErrorState` defaults now resolve via `useUiConfig()` | i18n |

Verification: frontend students suite **72 files / 237 tests pass**; `Card` spec **5/5**; full frontend
**5,008 pass / 2 skipped**; cold `tsc` pass; BiDi + shared-UI gates pass.

## 2. Remaining findings (deferred to subsequent rounds)

### Medium

| Component | File | Category | Issue |
| --- | --- | --- | --- |
| ToastClose | `packages/ui/src/toast/Toast.tsx:138-152` | accessible-name | Icon-only close has no default `aria-label` (latent — unused in app; the `Toast` close already has one) |

### Low (grouped)

- **Decorative icons missing `aria-hidden`:** `ModuleRowActionsMenu` (5), `EntityMessagingActions` (3),
  `StudentIdCardPrintControlsBar` (2), `StudentIdCardModal` (2), `StudentFormSectionShared` (1).
- **Dialog accessible-name fallback:** `packages/ui/modal/Modal` still renders `role="dialog"
  aria-modal` without a name when `title` is absent (the app-level `Modal` now supports `ariaLabel`).
- **Hardcoded English defaults in `packages/ui` primitives** (shipped when a consumer omits labels):
  `StatusBadge`, `ErrorState`, `EmptyState`-adjacent copy, `NotificationsPopover`, `Spinner`,
  `TableSkeleton`, `WizardStepIndicator`, `FormField` (AI labels), `OtpInput`, `PasswordInput`,
  `PasswordStrengthMeter`, `SearchBar`, `ConfirmAlertDialog`, `SessionTimeoutModal`, `TypedConfirmDialog`,
  `DensityToggle`, `ListPagination`, `TableEmpty`, `TableHead` (sort announcement), `UiConfigContext`
  default labels, `Toast`/`Toaster` regions. These are the `@mms/ui` package's English decoupling fallback;
  the fix is to resolve from each console's `UiConfig`/i18n rather than ship English.
**Out of scope (repo-wide `@mms/ui` i18n, not consumed by Students):** `StatusBadge`
`DEFAULT_LABELS` and `ErrorState` `DEFAULT_TITLES` are fallback maps the Students module never triggers
(it always passes `config`/`title`); the Students directory table localizes its own footer/empty state
(`WorkBatchTable`/`ModuleTableFooterCount`/`ModuleWorkDirectoryEmpty`). The remaining prop-default English
labels live in primitives the Students module does not import (`DensityToggle`, `WizardStepIndicator`,
`PasswordStrengthMeter`, `NotificationsPopover`, `SessionTimeoutModal`, `TypedConfirmDialog`, `OtpInput`,
`PasswordInput`, `FormField` AI suggestion) — used by accounting/enrollments/profile/auth/platform — and are
a separate cross-module i18n initiative, not part of this Students review.

## 3. Method, verification, external notes

- Fan-out audit returned 46 findings; applied 3 (1 high + 7 dir-auto edits + 1 shared semantic fix).
- **External (not this change):** the concurrent contacts/i18n work pushed
  `components/common/work/WorkBatchTable.tsx` to 336 lines (code-norms 300-line ratchet) and left a stale
  `shard-timings.json` entry for the removed `ContactTableRow.test.tsx` (1 full-suite failure). Both are
  unrelated to the Students/UI work and left untouched.
- Static audit only — no DB/E2E/axe run (no stack); `prefers-reduced-motion`, touch targets and BiDi are
  verified by source inspection + the machine gates, not by a real browser.

No production code beyond the listed fixes was changed; this document and its `docs/README.md` index row are
the only writes.
