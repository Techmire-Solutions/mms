# Button System Audit — 2026-11-06

**Status:** complete for the centralized primitive. The shared Button, its state tokens and
`CopyButton` are refactored; consumer-level overrides are measured and flagged, not mass-migrated.
**Baseline commit:** `c3e68b76a` (`fix(ui): ensure accessible hover text contrast on ghost buttons…`).

Scope: `packages/ui/src/button/Button.tsx`, `CopyButton.tsx`, the frontend token SSOT
`apps/frontend/src/index.css`, the `@shared/ui` facade, and every `<Button>` consumer (≈850
occurrences across 1,647 scanned source files). Runtime branding is in scope because it overwrites
the semantic tokens at runtime.

## 1. Method

- Token values parsed from `:root` / `.dark` and converted to hex; every ratio computed with the
  repo's own `getContrastRatio()` (`packages/shared/src/branding/brandingColorContrast.ts`), not a
  re-implementation.
- Tailwind 4.3.3 emission probes confirmed `rounded-lg → var(--radius)`, `duration-fast → 150ms`,
  `focus-visible:ring-offset-background → hsl(var(--background))`, and `:disabled` is emitted after
  `:hover`/`:active` (which is what lets a single `disabled:` reset suppress hover).
- Branding invariant sampled through `buildBrandingCssVariables`: 10,608 (hue, saturation,
  lightness, mode, role) pairs. Light mode always emits a white label (`0 0% 100%`), dark mode
  always the dark ink (`H 30% 12%`). The mode-matched hover anchor is therefore safe.
- Static analysis: 1,647 frontend/shared `.tsx` files; 850 `<Button>` occurrences; 48 raw
  `<button>` elements; 2 inline-styled Buttons.

## 2. Findings

| # | Severity | Finding | Evidence |
|---|---|---|---|
| F1 | P1 | Dark `success` hover fails AA: `hover:bg-success/90` over `--card` = **4.34:1** (4.29 on `--background`). The old hover alpha-composites against whatever surface is behind the button. | `--success #25b17e`, `--success-foreground #0b3224` |
| F2 | P1 | Focus ring offset used Tailwind's default `#ffffff`: dark ring `#f2ad0d` on white = **1.95:1** (WCAG 1.4.11 needs 3:1). Offset was also 1px vs the repo's 2px convention. | No `ring-offset-background` in `Button.tsx`; Tailwind default `--tw-ring-offset-color:#fff` |
| F3 | P1 | No pressed state: all variants rendered identically on `:active`. | 0 `active:` classes in `buttonVariants` |
| F4 | P1 | Disabled buttons still matched `:hover`, so a 50%-dimmed button changed fill on hover. | No `disabled:` hover reset |
| F5 | P2 | `asChild` ignored `disabled` and `isLoading` entirely: no `aria-disabled`, no `aria-busy`, no click guard. `AuthFormControls` passes `disabled` to an asChild link today and it is a no-op. | `Button.tsx` asChild branch |
| F6 | P2 | Loading swapped icons/label for the spinner, so width shifted; `asChild` had no loading semantics. | Loading branch |
| F7 | P2 | Radius was `rounded-xl` = `calc(var(--radius) + 4px)` (14px), not `--radius` (10px); `sm`/`lg`/`caps` repeated it. Inputs use `rounded-lg` = `var(--radius)`. | `index.css` radius scale |
| F8 | P3 | `link`'s compact classes (`min-h-6 p-0`) were dead: cva emits variant before size, and `cn` lets `size` keep `h-11 px-4`. The variant rendered as a padded 44px button. | cva + tailwind-merge order |
| F9 | P3 | `shadow` / `shadow-sm` are raw Tailwind defaults (fixed black), not the theme-aware `--shadow-surface` token. | `Button.tsx` |
| F10 | P3 | `CopyButton` bypassed variants: default primary Button restyled by `bg-muted-foreground/5`, its own border, shadow and 1px offset. | `CopyButton.tsx` |
| F11 | P3 | 12 consumer `hover:text-<token>/80` overrides fail on hover (`hover:text-primary/80` on white ≈ **3.94:1**); 6 are `<Button>`, 6 are raw `<Link>`/`<a>`. | source scan |
| F12 | Advisory | Outline border `--input` vs `--background` = **1.25:1** light / **1.39:1** dark. Not a 1.4.11 failure while the label identifies the control, but the outline/ghost distinction rests on that border. | token math |

**Verified clean:** 0 arbitrary colour expressions (`bg-[#…]`, `[rgb(…)]`, `[hsl(…)]`) repo-wide;
0 hardcoded colours in the Button primitives; the only 2 inline colour styles are the live branding
preview (`BrandSemanticPreviewActionsTab.tsx:21,29`), where arbitrary tenant colours are the point.

## 3. Audit matrix — before

`PASS*` = contrast passes, but the state is not actually defined. `N/A` = WCAG 1.4.3 exempts
inactive controls; the ratio is reported for visual quality.

### 3.1 Light theme (surface `--card`; `--background` is 0.1–0.4 different)

| Variant | State | Current Background | Current Text Color | Contrast Ratio | WCAG Pass/Fail | Issue / Recommendation |
|---|---|---|---|---|---|---|
| Primary / Default | Default | `#7f5c0a` | `#ffffff` | 6.11:1 | PASS | Base token pair |
| Primary / Default | Hover | `#8c6c22` | `#ffffff` | 4.90:1 | PASS | `bg-primary/90` over card; surface-dependent (worst 4.90) |
| Primary / Default | Active | `#7f5c0a` | `#ffffff` | 6.11:1 | PASS* | No active style — identical to default |
| Primary / Default | Focus | `#ffffff` | `#7f5c0a` | 6.11:1 | PASS | Ring vs card; offset relies on white by default |
| Primary / Default | Disabled | `#bfae85` | `#ffffff` | 2.19:1 | N/A | 50% opacity; hover still applies |
| Primary / Default | Loading | `#bfae85` | `#ffffff` | 2.19:1 | N/A | Spinner replaces icons/label → width shift; asChild ignores loading |
| Secondary | Default | `#5d3614` | `#fafaf9` | 10.04:1 | PASS | Base token pair |
| Secondary | Hover | `#7d5e43` | `#fafaf9` | 5.66:1 | PASS | `bg-secondary/80`; surface-dependent |
| Secondary | Active | `#5d3614` | `#fafaf9` | 10.04:1 | PASS* | No active style |
| Secondary | Focus | `#ffffff` | `#7f5c0a` | 6.11:1 | PASS | Ring vs card |
| Secondary | Disabled | `#ae9b8a` | `#fdfdfc` | 2.63:1 | N/A | 50% opacity; hover still applies |
| Secondary | Loading | `#ae9b8a` | `#fdfdfc` | 2.63:1 | N/A | Width shift |
| Destructive / Danger | Default | `#bc1010` | `#fafafa` | 6.25:1 | PASS | Base token pair |
| Destructive / Danger | Hover | `#c32828` | `#fafafa` | 5.51:1 | PASS | `bg-destructive/90`; surface-dependent |
| Destructive / Danger | Active | `#bc1010` | `#fafafa` | 6.25:1 | PASS* | No active style |
| Destructive / Danger | Focus | `#ffffff` | `#7f5c0a` | 6.11:1 | PASS | Ring vs card |
| Destructive / Danger | Disabled | `#de8888` | `#fdfdfd` | 2.59:1 | N/A | 50% opacity; hover still applies |
| Destructive / Danger | Loading | `#de8888` | `#fdfdfd` | 2.59:1 | N/A | Width shift |
| Success | Default | `#137136` | `#ffffff` | 6.10:1 | PASS | Base token pair |
| Success | Hover | `#2b7f4a` | `#ffffff` | 4.96:1 | PASS | `bg-success/90`; surface-dependent |
| Success | Active | `#137136` | `#ffffff` | 6.10:1 | PASS* | No active style |
| Success | Focus | `#ffffff` | `#7f5c0a` | 6.11:1 | PASS | Ring vs card |
| Success | Disabled | `#89b89b` | `#ffffff` | 2.24:1 | N/A | 50% opacity; hover still applies |
| Success | Loading | `#89b89b` | `#ffffff` | 2.24:1 | N/A | Width shift |
| Outline | Default | `#ffffff` | `#2e1e0f` | 16.05:1 | PASS | Transparent; border 1.25:1 (advisory F12) |
| Outline | Hover | `#f1f0ee` | `#2e1e0f` | 14.09:1 | PASS | `hover:bg-muted` |
| Outline | Active | `#ffffff` | `#2e1e0f` | 16.05:1 | PASS* | No active style |
| Outline | Focus | `#ffffff` | `#7f5c0a` | 6.11:1 | PASS | Ring vs card |
| Outline | Disabled | `#ffffff` | `#978f87` | 3.18:1 | N/A | 50% opacity; hover still applies |
| Outline | Loading | `#ffffff` | `#978f87` | 3.18:1 | N/A | Width shift |
| Ghost | Default | `#ffffff` | `#2e1e0f` | 16.05:1 | PASS | Transparent |
| Ghost | Hover | `#f1f0ee` | `#2e1e0f` | 14.09:1 | PASS | `hover:bg-muted` |
| Ghost | Active | `#ffffff` | `#2e1e0f` | 16.05:1 | PASS* | No active style |
| Ghost | Focus | `#ffffff` | `#7f5c0a` | 6.11:1 | PASS | Ring vs card |
| Ghost | Disabled | `#ffffff` | `#978f87` | 3.18:1 | N/A | 50% opacity; hover still applies |
| Ghost | Loading | `#ffffff` | `#978f87` | 3.18:1 | N/A | Width shift |
| Link | Default | `#ffffff` | `#7f5c0a` | 6.11:1 | PASS | Transparent |
| Link | Hover | `#ffffff` | `#7f5c0a` | 6.11:1 | PASS | `hover:underline` only |
| Link | Active | `#ffffff` | `#7f5c0a` | 6.11:1 | PASS* | No active style |
| Link | Focus | `#ffffff` | `#7f5c0a` | 6.11:1 | PASS | Ring vs card |
| Link | Disabled | `#ffffff` | `#bfae85` | 2.19:1 | N/A | 50% opacity; hover still applies |
| Link | Loading | `#ffffff` | `#bfae85` | 2.19:1 | N/A | Width shift |

Capsule family (default / hover / active):

| Variant | State | Background | Text | Ratio | Pass/Fail | Issue |
|---|---|---|---|---|---|---|
| capsPrimary | Default | `#7f5c0a` | `#ffffff` | 6.11:1 | PASS | Solid primary chip |
| capsPrimary | Hover | `#8c6c22` | `#ffffff` | 4.90:1 | PASS | Surface-dependent `/90` |
| capsPrimary | Active | `#7f5c0a` | `#ffffff` | 6.11:1 | PASS* | No active style |
| capsOutline | Default | `#ffffff` | `#6d6055` | 6.08:1 | PASS | `bg-card/50` |
| capsOutline | Hover | `#fbfbfa` | `#2e1e0f` | 15.50:1 | PASS | `bg-muted/30` |
| capsOutline | Active | `#ffffff` | `#6d6055` | 6.08:1 | PASS* | No active style |
| capsGhost | Default | `#ffffff` | `#6d6055` | 6.08:1 | PASS | Transparent |
| capsGhost | Hover | `#fbfbfa` | `#2e1e0f` | 15.50:1 | PASS | `bg-muted/30` |
| capsGhost | Active | `#ffffff` | `#6d6055` | 6.08:1 | PASS* | No active style |
| capsSuccess | Default | `#e7f1eb` | `#137136` | 5.28:1 | PASS | `bg-success/10` |
| capsSuccess | Hover | `#dceae1` | `#137136` | 4.91:1 | PASS | `/15` ceiling |
| capsSuccess | Active | `#dceae1` | `#137136` | 4.91:1 | PASS* | Same as hover |
| capsDestructive | Default | `#f8e7e7` | `#bc1010` | 5.46:1 | PASS | `bg-destructive/10` |
| capsDestructive | Hover | `#f5dbdb` | `#bc1010` | 4.98:1 | PASS | `/15` ceiling |
| capsDestructive | Active | `#f5dbdb` | `#bc1010` | 4.98:1 | PASS* | Same as hover |
| capsAccent | Default | `#f2efe7` | `#7f5c0a` | 5.32:1 | PASS | `bg-primary/10` |
| capsAccent | Hover | `#ece7da` | `#7f5c0a` | 4.95:1 | PASS | `/15` ceiling |
| capsAccent | Active | `#ece7da` | `#7f5c0a` | 4.95:1 | PASS* | Same as hover |

### 3.2 Dark theme (surface `--card`)

| Variant | State | Current Background | Current Text Color | Contrast Ratio | WCAG Pass/Fail | Issue / Recommendation |
|---|---|---|---|---|---|---|
| Primary / Default | Default | `#f2ad0d` | `#2a1809` | 8.73:1 | PASS | Base token pair |
| Primary / Default | Hover | `#dd9f0e` | `#2a1809` | 7.33:1 | PASS | Surface-dependent (worst 7.25) |
| Primary / Default | Active | `#f2ad0d` | `#2a1809` | 8.73:1 | PASS* | No active style |
| Primary / Default | Focus | `#1e1c1a` | `#f2ad0d` | 8.70:1 | PASS | Ring vs card |
| Primary / Default | **Focus offset** | `#ffffff` | `#f2ad0d` | **1.95:1** | **FAIL** | Default white offset — needs 3:1 |
| Primary / Default | Disabled | `#886514` | `#241a12` | 3.18:1 | N/A | 50% opacity; hover still applies |
| Primary / Default | Loading | `#886514` | `#241a12` | 3.18:1 | N/A | Width shift |
| Secondary | Default | `#d7b375` | `#141210` | 9.43:1 | PASS | Base token pair |
| Secondary | Hover | `#b29563` | `#141210` | 6.56:1 | PASS | `bg-secondary/80`; surface-dependent (worst 6.40) |
| Secondary | Active | `#d7b375` | `#141210` | 9.43:1 | PASS* | No active style |
| Secondary | Focus | `#1e1c1a` | `#f2ad0d` | 8.70:1 | PASS | Ring vs card |
| Secondary | Focus offset | `#ffffff` | `#f2ad0d` | 1.95:1 | FAIL | White offset |
| Secondary | Disabled | `#7b6848` | `#191715` | 3.33:1 | N/A | 50% opacity; hover still applies |
| Secondary | Loading | `#7b6848` | `#191715` | 3.33:1 | N/A | Width shift |
| Destructive / Danger | Default | `#ea8080` | `#350909` | 6.61:1 | PASS | Base token pair |
| Destructive / Danger | Hover | `#d67676` | `#350909` | 5.62:1 | PASS | Surface-dependent (worst 5.55) |
| Destructive / Danger | Active | `#ea8080` | `#350909` | 6.61:1 | PASS* | No active style |
| Destructive / Danger | Focus | `#1e1c1a` | `#f2ad0d` | 8.70:1 | PASS | Ring vs card |
| Destructive / Danger | Focus offset | `#ffffff` | `#f2ad0d` | 1.95:1 | FAIL | White offset |
| Destructive / Danger | Disabled | `#844e4d` | `#2a1312` | 2.65:1 | N/A | 50% opacity; hover still applies |
| Destructive / Danger | Loading | `#844e4d` | `#2a1312` | 2.65:1 | N/A | Width shift |
| **Success** | Default | `#25b17e` | `#0b3224` | 5.13:1 | PASS | Base token pair |
| **Success** | **Hover** | `#24a274` | `#0b3224` | **4.34:1** | **FAIL** | F1 — `bg-success/90` on the dark card |
| Success | Active | `#25b17e` | `#0b3224` | 5.13:1 | PASS* | No active style |
| Success | Focus | `#1e1c1a` | `#f2ad0d` | 8.70:1 | PASS | Ring vs card |
| Success | Focus offset | `#ffffff` | `#f2ad0d` | 1.95:1 | FAIL | White offset |
| Success | Disabled | `#22674c` | `#15271f` | 2.32:1 | N/A | 50% opacity; hover still applies |
| Success | Loading | `#22674c` | `#15271f` | 2.32:1 | N/A | Width shift |
| Outline | Default | `#1e1c1a` | `#f0ece6` | 14.44:1 | PASS | Transparent; border 1.39:1 (advisory) |
| Outline | Hover | `#292623` | `#f0ece6` | 12.79:1 | PASS | `hover:bg-muted` |
| Outline | Active | `#1e1c1a` | `#f0ece6` | 14.44:1 | PASS* | No active style |
| Outline | Focus | `#1e1c1a` | `#f2ad0d` | 8.70:1 | PASS | Ring vs card |
| Outline | Focus offset | `#ffffff` | `#f2ad0d` | 1.95:1 | FAIL | White offset |
| Outline | Disabled | `#1e1c1a` | `#878480` | 4.56:1 | N/A | 50% opacity; hover still applies |
| Outline | Loading | `#1e1c1a` | `#878480` | 4.56:1 | N/A | Width shift |
| Ghost | Default | `#1e1c1a` | `#f0ece6` | 14.44:1 | PASS | Transparent |
| Ghost | Hover | `#292623` | `#f0ece6` | 12.79:1 | PASS | `hover:bg-muted` |
| Ghost | Active | `#1e1c1a` | `#f0ece6` | 14.44:1 | PASS* | No active style |
| Ghost | Focus | `#1e1c1a` | `#f2ad0d` | 8.70:1 | PASS | Ring vs card |
| Ghost | Focus offset | `#ffffff` | `#f2ad0d` | 1.95:1 | FAIL | White offset |
| Ghost | Disabled | `#1e1c1a` | `#878480` | 4.56:1 | N/A | 50% opacity; hover still applies |
| Ghost | Loading | `#1e1c1a` | `#878480` | 4.56:1 | N/A | Width shift |
| Link | Default | `#1e1c1a` | `#f2ad0d` | 8.70:1 | PASS | Transparent |
| Link | Hover | `#1e1c1a` | `#f2ad0d` | 8.70:1 | PASS | `hover:underline` |
| Link | Active | `#1e1c1a` | `#f2ad0d` | 8.70:1 | PASS* | No active style |
| Link | Focus | `#1e1c1a` | `#f2ad0d` | 8.70:1 | PASS | Ring vs card |
| Link | Focus offset | `#ffffff` | `#f2ad0d` | 1.95:1 | FAIL | White offset |
| Link | Disabled | `#1e1c1a` | `#886514` | 3.17:1 | N/A | 50% opacity; hover still applies |
| Link | Loading | `#1e1c1a` | `#886514` | 3.17:1 | N/A | Width shift |

Capsule family (default / hover / active):

| Variant | State | Background | Text | Ratio | Pass/Fail | Issue |
|---|---|---|---|---|---|---|
| capsPrimary | Default | `#f2ad0d` | `#2a1809` | 8.73:1 | PASS | Solid primary chip |
| capsPrimary | Hover | `#dd9f0e` | `#2a1809` | 7.33:1 | PASS | `/90` |
| capsPrimary | Active | `#f2ad0d` | `#2a1809` | 8.73:1 | PASS* | No active style |
| capsOutline | Default | `#1e1c1a` | `#a89e8a` | 6.41:1 | PASS | `bg-card/50` |
| capsOutline | Hover | `#211f1d` | `#f0ece6` | 13.96:1 | PASS | `bg-muted/30` |
| capsOutline | Active | `#1e1c1a` | `#a89e8a` | 6.41:1 | PASS* | No active style |
| capsGhost | Default | `#1e1c1a` | `#a89e8a` | 6.41:1 | PASS | Transparent |
| capsGhost | Hover | `#211f1d` | `#f0ece6` | 13.96:1 | PASS | `bg-muted/30` |
| capsGhost | Active | `#1e1c1a` | `#a89e8a` | 6.41:1 | PASS* | No active style |
| capsSuccess | Default | `#1f2b24` | `#25b17e` | 5.37:1 | PASS | `bg-success/10` |
| capsSuccess | Hover | `#1f3229` | `#25b17e` | 4.96:1 | PASS | `/15` ceiling |
| capsSuccess | Active | `#1f3229` | `#25b17e` | 4.96:1 | PASS* | Same as hover |
| capsDestructive | Default | `#322624` | `#ea8080` | 5.49:1 | PASS | `bg-destructive/10` |
| capsDestructive | Hover | `#3d2b29` | `#ea8080` | 5.01:1 | PASS | `/15` ceiling |
| capsDestructive | Active | `#3d2b29` | `#ea8080` | 5.01:1 | PASS* | Same as hover |
| capsAccent | Default | `#332b19` | `#f2ad0d` | 7.17:1 | PASS | `bg-primary/10` |
| capsAccent | Hover | `#3e3218` | `#f2ad0d` | 6.43:1 | PASS | `/15` ceiling |
| capsAccent | Active | `#3e3218` | `#f2ad0d` | 6.43:1 | PASS* | Same as hover |

**Non-text checks (before):** `--ring` vs `--card` 6.11:1 light / 8.70:1 dark — pass 3:1. Against the
default white offset: 6.11:1 light (pass), **1.95:1 dark (fail)**. Outline border vs background:
1.25:1 / 1.39:1 (advisory F12). Disabled states are 1.4.3-exempt but sit at 2.19–3.33:1.

## 4. Flagged anti-patterns

| Category | Count | Hotspots / verdict |
|---|---|---|
| Arbitrary colour classes (`bg-[#…]`, `[rgb(…)]`, `[hsl(…)]`) | **0** | Clean — the token layer is being respected |
| Hardcoded colours in Button primitives | **0** | Clean |
| Inline colour style on `<Button>` | **2** | `BrandSemanticPreviewActionsTab.tsx:21,29` — **documented exception** (live tenant-brand preview) |
| `<Button className>` colour/shadow/radius overrides | **212 files** | 166 `bg-*`, 224 `text-*`, 84 `border-*`, 78 `shadow-*`, 45 `ring-*` occurrences. Advisory backlog; prefer a variant |
| Semantic solid/tint overrides on `<Button>` | **53 files / 71 occurrences** | e.g. `ExportToolbarCompact`, `PlatformDashboardQuickActions`, `WakalaTypeCard`, `UserDetailBasicCard` — should use `default` / `capsAccent` / `capsSuccess` |
| Styled raw `<button>` elements | **17 files / 48 elements** | `calendar.tsx`, `YearPickerGrid`, `DatePickerCalendarContent`, `OptionSelectPopover`, `TableHead`, `TemplateEditorLayerList` — bypass `Button` (third-party render props and dense pickers are acceptable exceptions) |
| Direct `buttonVariants()` calls | **6 files** | `calendar.tsx`, `YearPickerGrid`, `AlertDialog`, `ConfirmAlertDialog`, `Button`, facade. Acceptable for third-party render props; the AlertDialog actions could use `Button` |
| `hover:text-<token>/80` hover overrides | **12 sites** | `hover:text-primary/80` ≈ 3.94:1 on white; replace with `hover:underline` or keep the resting token (F11) |
| `<Button>` without explicit `type` | **789** | The 3 inside `<form>` files are action buttons; implicit submit is a latent hazard. Defaulting `type="button"` is a follow-up, not done here |
| `link` compact sizing | **1 variant** | Dead `min-h-6 p-0` removed; the rendered 44px size is unchanged because callers rely on it (F8) |

## 5. What changed

### 5.1 Token layer — `apps/frontend/src/index.css`

```css
/* :root — light labels are white, so hover/active darken away from the label */
--button-primary-hover: color-mix(in srgb, hsl(var(--primary)) 90%, black);
--button-primary-active: color-mix(in srgb, hsl(var(--primary)) 82%, black);
/* …secondary / destructive / success */
--color-button-primary-hover: var(--button-primary-hover); /* @theme inline */
--transition-duration-fast: var(--duration-fast);          /* makes `duration-fast` emit */

/* .dark — dark labels are the dark ink, so hover/active lighten */
--button-primary-hover: color-mix(in srgb, hsl(var(--primary)) 90%, white);
--button-primary-active: color-mix(in srgb, hsl(var(--primary)) 82%, white);
```

Derived tokens resolve against the branding injector's inline `--primary`/`--secondary`/… overrides,
so a tenant accent, corner preset and dark/light toggle need no rebuild. The full contract comment is
in `index.css` next to the token block.

### 5.2 Primitive — `packages/ui/src/button/Button.tsx`

- `rounded-lg` (emits `border-radius: var(--radius)`), `focus-visible:ring-2 ring-ring ring-offset-2
  ring-offset-background`, `transition duration-fast ease-calm motion-reduce:transition-none`,
  `active:scale-tap`, `disabled:scale-100`, `disabled:cursor-not-allowed disabled:opacity-50`,
  `aria-disabled:*` for slot children.
- Solid hover/active now use the role tokens; a `disabled:bg-<role>` reset (emitted after `:hover`
  and `:active` in Tailwind v4) suppresses hover/active without raising specificity for enabled
  buttons, so consumer overrides keep working.
- Caps tinted variants stay at the `/15` ceiling and gain the pressed scale.
- Loading keeps the original content mounted (`opacity-0`, width reserved); a centred spinner
  overlays it. When `loadingText` is supplied it becomes the visible label and the old label is
  `aria-hidden`; otherwise the old label remains the accessible name. `aria-busy="true"`,
  `aria-disabled="true"`, native `disabled`, and `data-loading` are set; `asChild` gets the same
  ARIA plus a click guard (no native `disabled` on anchors).
- `type` is deliberately not defaulted (risk across 789 untyped call sites) — see follow-ups.

### 5.3 `CopyButton`

Icon-only now renders `variant="outline" size="icon"` with only `text-muted-foreground` and the
opacity reveal; the bespoke `DEFAULT_ICON_BTN_CLASS` (border, tint, shadow, 1px offset, radius) is
deleted. The labelled branch drops its `rounded-xl`. The `variant` union is narrowed to
`ghost | outline` — a solid `default` fill left the muted icon at ~1.7:1, and no consumer used it.

## 6. Audit matrix — after

All values from the new tokens; tested by `designTokens.contrast.test.ts`.

### 6.1 Light

| Variant | Default | Hover | Active | Focus ring | Verdict |
|---|---|---|---|---|---|
| Primary / Default | 6.11:1 | 7.10:1 | 8.08:1 | 6.11:1 | PASS |
| Secondary | 10.04:1 | 11.02:1 | 12.00:1 | 6.11:1 | PASS |
| Destructive / Danger | 6.25:1 | 7.30:1 | 8.25:1 | 6.11:1 | PASS |
| Success | 6.10:1 | 7.07:1 | 8.00:1 | 6.11:1 | PASS |
| Outline | 16.05:1 | 14.09:1 | 14.47:1 | 6.11:1 | PASS |
| Ghost | 16.05:1 | 14.09:1 | 14.47:1 | 6.11:1 | PASS |
| Link | 6.11:1 | 6.11:1 | 6.11:1 | 6.11:1 | PASS |
| capsPrimary | 6.11:1 | 7.10:1 | 8.08:1 | 6.11:1 | PASS |
| capsOutline | 6.08:1 | 15.50:1 | 14.47:1 | 6.11:1 | PASS |
| capsGhost | 6.08:1 | 15.50:1 | 14.47:1 | 6.11:1 | PASS |
| capsSuccess | 5.28:1 | 4.91:1 | 4.91:1 | 6.11:1 | PASS |
| capsDestructive | 5.46:1 | 4.98:1 | 4.98:1 | 6.11:1 | PASS |
| capsAccent | 5.32:1 | 4.95:1 | 4.95:1 | 6.11:1 | PASS |

Ring vs `--card` 6.11:1 · vs `--background` 5.85:1.

### 6.2 Dark

| Variant | Default | Hover | Active | Focus ring | Verdict |
|---|---|---|---|---|---|
| Primary / Default | 8.73:1 | 9.28:1 | 9.81:1 | 8.70:1 | PASS |
| Secondary | 9.43:1 | 10.19:1 | 10.79:1 | 8.70:1 | PASS |
| Destructive / Danger | 6.61:1 | 7.34:1 | 7.96:1 | 8.70:1 | PASS |
| Success | 5.13:1 | 5.68:1 | 6.15:1 | 8.70:1 | PASS |
| Outline | 14.44:1 | 12.79:1 | 13.12:1 | 8.70:1 | PASS |
| Ghost | 14.44:1 | 12.79:1 | 13.12:1 | 8.70:1 | PASS |
| Link | 8.70:1 | 8.70:1 | 8.70:1 | 8.70:1 | PASS |
| capsPrimary | 8.73:1 | 9.28:1 | 9.81:1 | 8.70:1 | PASS |
| capsOutline | 6.41:1 | 13.96:1 | 13.12:1 | 8.70:1 | PASS |
| capsGhost | 6.41:1 | 13.96:1 | 13.12:1 | 8.70:1 | PASS |
| capsSuccess | 5.37:1 | 4.96:1 | 4.96:1 | 8.70:1 | PASS |
| capsDestructive | 5.49:1 | 5.01:1 | 5.01:1 | 8.70:1 | PASS |
| capsAccent | 7.17:1 | 6.43:1 | 6.43:1 | 8.70:1 | PASS |

Ring vs `--card` 8.70:1 · vs `--background` 9.57:1. The old white offset (1.95:1) is gone because the
offset now resolves to `--background`. Disabled states remain 1.4.3-exempt.

## 7. Accessibility semantics

| State | Native button | `asChild` link |
|---|---|---|
| Disabled | native `disabled` + `aria-disabled="true"` + `cursor-not-allowed` | `aria-disabled="true"` + click `preventDefault`/`stopPropagation` + `pointer-events-none` |
| Loading | `disabled` + `aria-busy="true"` + `aria-disabled="true"` + spinner + reserved width | `aria-busy="true"` + `aria-disabled="true"` + click guard (no injected spinner — slot single-child constraint) |
| Focus | 2px `ring-ring`, 2px `ring-offset-background` | same |
| Name | `aria-label` or `title` or visible content; busy content kept in the tree | same (no aria-hidden) |

## 8. Verification

Run during this change:

- **Full frontend suite:** 1,165 test files, **4,368 passed / 2 skipped**, exit 0. This includes the
  Button, WorkBatchTable, ExportToolbar, Modal, DatePicker and form suites that consume the
  shared primitive.
- Targeted `vitest` (5 files / 80 tests): token contrast matrix, variant contract, primitive token
  guard, Button behaviour, CopyButton, assertion-specificity ratchet, existing hover-contrast suite
  — all pass. Red evidence before the fix: 22 failures (missing `--button-*`, `rounded-xl`,
  `aria-disabled` on asChild, CopyButton override).
- `pnpm typecheck` (all 5 packages) and `pnpm --filter @mms/ui typecheck` — pass.
- `pnpm --filter mms-frontend lint` — pass.
- `node scripts/check-code-norms.mjs` — all ratchets held (`any` 0, arbitrary colours 0, inert
  tokens 0); `node scripts/check-shared-ui.mjs` — 0 violations; `node scripts/check-docs.mjs` — 0
  violations; BiDi checker — 0 violations.
- `pnpm --filter mms-frontend build` — pass (exit 0). The built CSS contains `button-primary-hover`,
  `duration-fast`, and `ring-offset-color:hsl(var(--background))`.
- The first full-suite run surfaced one ratchet regression: `testAssertionSpecificity` counted one
  new `toBeDefined()` in this change. It was tightened (explicit missing-token throw), not
  re-baselined; the ratchet now passes at its original 281 baseline.

Not run here: the rendered Playwright axe sweep (`e2e/tests/a11y-shell.spec.ts`). It needs the app,
backend and a seeded database, which are not running in this workspace; CI remains the rendered
gate. Do not read this static matrix as a claim of full rendered conformance (forced colours,
zoom/reflow, focus not obscured still need a browser pass). `mms-a11y-smoke` static mode was used
only as a nudge.

## 9. Follow-ups

1. **Consumer override burn-down (P2):** 212 files override colour/shadow/radius on `<Button>`; 53
   override semantic fills. Add a baseline ratchet after the first migration batch.
2. **Hover text alpha (P3):** 12 `hover:text-<token>/80` sites (6 Button, 6 raw links) drop to
   ≈3.94:1 on hover; remove the alpha shift and keep underline feedback.
3. **`type="button"` default (P2):** 789 untyped call sites; audit implicit-submit usage before
   changing. `FormSubmitActions` already sets `type="submit"`.
4. **`link` sizing (P3):** the dead compact classes were removed; if a true inline link is wanted,
   move its layout into `compoundVariants` and keep the `touch-target-coarse` escape hatch.
5. **Raw button migration (P3):** `YearPickerGrid`, `DatePickerCalendarContent` and
   `OptionSelectPopover` can use `<Button size="icon">`; the third-party DayPicker render props can
   keep `buttonVariants`.
6. **Rendered verification:** run the full axe sweep (light + dark + RTL) once services are up.
