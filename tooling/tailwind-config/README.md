# `@mms/tailwind-config`

Single source of truth for the MMS design tokens, runtime CSS variables and the
BiDi/RTL utility layer. `apps/frontend` consumes it today; `apps/tenant-web` and
`apps/platform-web` will consume the same file after the P7 split. `packages/ui`
consumes the tokens through the consuming app's stylesheet (the app's `@source`
globs include `packages/ui/src`).

## What is in `theme.css`

- `@custom-variant dark` (the `.dark` class variant),
- `@theme inline` — the Tailwind v4 token namespace (fonts, type scale, radius,
  spacing, z-index, scale, blur, animations),
- the three keyframes referenced by `--animate-*` tokens,
- `:root`, `:root:has(> head > meta[name="color-scheme"] …)` and `.dark` — the
  semantic HSL/oklch variables that the runtime branding engine overrides,
- BiDi/RTL utilities that are safe to share: `mask-fade-inline-*`,
  `mask-fade-block-*` (logical-axis edge fades, `:dir(rtl)` aware),
  `touch-target-coarse` (logical min-inline/block sizing), and
  `font-arabic` / `font-urdu` / `font-persian`.

App-specific layout utilities (`top-header`, `spa-view-hidden`, table/row helpers,
print styles, module grids, …) stay in the app stylesheet.

## Usage

```css
/* apps/<app>/src/index.css */
@import "tailwindcss";
@import "tw-animate-css";
@import "@mms/tailwind-config/theme.css";

/* `@source` stays app-side: globs resolve relative to this stylesheet. */
@source "../index.html";
@source "./**/*.{js,jsx,ts,tsx}";
@source "../../../packages/ui/src/**/*.{js,jsx,ts,tsx}";
```

and in the app `package.json`: `"@mms/tailwind-config": "workspace:*"`.

If a bundler/PostCSS setup cannot resolve the package specifier, use the relative
form `@import "../../../tooling/tailwind-config/theme.css";` — the token source is
identical.

## Rules

- Token **values** are a WCAG contract: `apps/frontend/src/__tests__/designTokens.contrast.test.ts`
  parses `:root`/`.dark` and must pass after any change here.
- Never declare `--font-size-*` / `--line-height-*` / `--shadow-*` style v3 names;
  Tailwind v4 silently emits nothing for them (`pnpm run check:code-norms` guards
  this file through `SCAN_DIRS`).
- New shared utilities must use logical properties (`inline`/`block`) or `:dir()`,
  never physical `left`/`right`, for BiDi parity.
