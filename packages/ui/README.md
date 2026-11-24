# `@mms/ui`

The single source of truth for shared React components: design-system
primitives, layout shells, table primitives, form controls and dumb UI.

## Entry points

| Import                    | Contents                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@mms/ui`                 | Primitive/composite barrel (theme, buttons, inputs, tables, overlays, feedback, data display, layout shells) |
| `@mms/ui/form`            | React Hook Form primitives (`Form*`, `useFormField`) and form style tokens                                   |
| `@mms/ui/calendar`        | Calendar/DayPicker, dropdown caption, locale formatters, DatePicker type surface                             |
| `@mms/ui/app/<Component>` | Individually exported app-level dumb components (ActionButton, PageHeader, detail-drawer chrome, …)          |

## Purity contract

`packages/ui/src` must not import:

- `react-router` or any routing helper;
- `@tanstack/react-query`, `@ts-rest/*` or any API client;
- `@mms/fe-core`, `@mms/be-core`, `@mms/db` or module packages;
- app aliases (`@/...`) or `apps/...`;
- network APIs (`fetch`, `XMLHttpRequest`, `axios`).

It only depends on `@mms/contracts` (types/pure helpers) plus presentation
libraries already used by the primitives (Radix, lucide, framer-motion,
react-day-picker, recharts, …).

## I18n & RTL

Components read labels from `UiConfigProvider`; the app's `UiConfigBridge`
feeds translated labels/language/`dir` from the tenant translation context.
Defaults are English/LTR, so every primitive renders standalone in tests.
Direction-sensitive styling uses logical CSS properties and the `dir` config.

`pnpm run check:core-packages` and `pnpm run check:shared-ui` enforce these
rules. The former also asserts that each package manifest's workspace
dependencies match this contract, that relative imports cannot escape the
package, and that a `@mms/fe-core` component sharing a basename with a primitive
here consumes `@mms/ui` (adapter/facade) instead of forking it. The legacy
`apps/frontend/src/components/ui/*` paths remain typed facades re-exporting this
package.
