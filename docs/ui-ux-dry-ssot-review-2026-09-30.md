# UI/UX and shared component review — 30 September 2026

## Scope

Reviewed shared control/surface/feedback primitives and platform console consumers, with a frontend-wide native-control inventory and BiDi scan. The inventory contains 1,447 non-test TSX files, including 348 in `components/ui`. This is a shared-layer consolidation, not an exhaustive manual review of every feature component.

## Changes applied

| Finding | Resolution |
| --- | --- |
| Card and form surfaces repeated the same styling | `CARD_SURFACE` now owns the common classes; `Card` and `FORM_CARD` consume it. Reduced-motion handling is included. |
| Compact inputs repeated standard input styles | `FORM_INPUT_COMPACT` derives from `FORM_INPUT`, with class conflict resolution. Disabled styling is shared. |
| Toolbar and mini-select tokens lacked visible keyboard focus | Added focus rings to both token definitions and included them in the existing contract test. |
| Empty and error states duplicated layout | Both consume `FeedbackStateLayout`, preserving alert/status semantics, optional actions, and dashed empty states. Text can wrap. |
| Platform controls bypassed primitives | Permission matrix uses `Table`, `Button`, and `SearchBar`; command results and theme choices use `Button`. No raw native buttons/inputs/selects/textareas remain in non-test platform source. |
| Permission buttons had 28px targets and no pressed state | Shared icon buttons provide 44px targets; accessible names identify the operator and capability; `aria-pressed` communicates the grant. |
| Capability names and permission defaults were duplicated | Matrix and badges share `PLATFORM_PERMISSION_CONFIG`; updates use `normalizePlatformAdminPermissions`. |
| Theme choices duplicated the shared mode catalog | Panel uses `THEME_MODE_OPTIONS` and existing translated labels. |
| Accent picker changed only its label; mode changes bypassed generated tokens | Replaced fake accent controls with the actual platform palette. A separate preview hook applies the shared document theme, handles system preference changes, removes listeners, and restores the default on close. The panel is explicitly titled Live Preview. |

## Verification

- Monorepo `pnpm typecheck`: passed; final frontend typecheck also passed.
- Frontend ESLint: passed.
- Shared UI and platform Vitest suites: 156 files / 605 tests passed.
- New theme-preview lifecycle test: 1 test passed separately.
- Playwright `a11y-shell.spec.ts` and `responsive-shell.spec.ts`: 23 tests passed, including authenticated axe scans and 375/768/1440px responsive checks with LTR/RTL coverage.
- BiDi checker: 3,330 source files scanned, passed.
- `git diff --check`: passed.

The initial sandboxed browser run could not start its backend/browser. The approved retry completed successfully. Browser coverage is the repository's representative route suite; it does not visit every feature or the platform appearance panel. The appearance lifecycle is covered by the component test.

## Follow-up

The subsequent [platform-wide ownership review](archive/platform-ui-ownership-review.md) consolidates platform navigation, actions, permissions, selection cards, and metrics, and replaces the permission matrix with the virtualized shared table.

## Remaining review scope at the end of the initial pass

- Inspect feature-specific native controls individually. Primitive internals, file pickers, print editors, and specialized interactions need different treatment; a blanket tag replacement is unsafe.
- The permission matrix still renders all returned operators; confirm expected collection size and add the existing virtualized directory pattern if it can exceed 30 rows.
- Remaining platform settings copy and feature-local status/metric structures need a separate consumer-by-consumer audit.
- Appearance is a temporary preview of platform-owned branding. Persistent customization would require an explicit preference model and integration with the apex theme lifecycle.

No new dependencies, database changes, commits, or pushes were made.
