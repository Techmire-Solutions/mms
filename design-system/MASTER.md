# MMS Master Design System

**Target Domain:** Multi-Tenant Madrasa Management System (Admin, Teacher, and Guardian/Parent Portals)  
**Primary Stack:** React 19 + Tailwind CSS v4 + TanStack Query v5 + Radix UI Primitives  
**Visual Style:** Minimalism & Swiss Style (Clean, high contrast, geometric, information-dense, dark-theme primary)  
**Applicability:** Desktop & Mobile-first viewports (375px, 768px, 1024px, 1440px)

---

## 1. Visual Pattern & Architecture

### Layout Hierarchy

1. **App Shell & Top Navigation:** Unified 56px (`h-14`) mobile top bar and responsive desktop header.
2. **Command Centre / Welcome Banner:** Greeting tailored to active role (Admin, Teacher, Accountant) with progressive Gregorian & Hijri dates.
3. **KPI Statistics Grid:** 4-tier metrics overview (2 columns on mobile, 4 on desktop). Cards provide actionable next steps when empty (`0` / `Rs 0`).
4. **Primary Module Directory & Analytics Tabs:** 3-tier operational architecture (`Work`, `Reports`, `Setup`).
5. **Interactive Density:** Comfortable density on touch devices (`min-h-11 min-w-11` touch targets); compact data density in enterprise tables.

---

## 2. Colour System & Tokens

### Semantic HSL Tokens

All application colours map strictly to semantic CSS tokens. Arbitrary hex codes or utility bracket colours are prohibited in application code.

| Token                  | Light Mode Value          | Dark Mode Value           | Purpose                              |
| :--------------------- | :------------------------ | :------------------------ | :----------------------------------- |
| `--background`         | `43 38% 97%` (`#fbf9f4`)  | `30 18% 8%` (`#171410`)   | Base application background          |
| `--foreground`         | `24 10% 10%`              | `30 15% 92%`              | High-contrast body text              |
| `--card`               | `0 0% 100%`               | `30 14% 12%` (`#221e1a`)  | Elevate containers, cards, modals    |
| `--card-foreground`    | `24 10% 10%`              | `30 15% 92%`              | Text on card surfaces                |
| `--primary`            | `173 80% 26%` (`#0d9488`) | `173 80% 40%` (`#14b8a6`) | Brand teal (actions, focus, accents) |
| `--primary-foreground` | `0 0% 100%`               | `173 100% 5%`             | High-contrast label on primary       |
| `--secondary`          | `173 58% 39%`             | `173 40% 20%`             | Secondary badges and borders         |
| `--muted`              | `40 20% 92%`              | `30 10% 16%`              | Inactive backgrounds, skeleton boxes |
| `--muted-foreground`   | `24 5% 45%`               | `30 10% 65%`              | Subtitles, metadata, placeholders    |
| `--border`             | `40 15% 85%`              | `30 10% 20%`              | Dividers, container boundaries       |
| `--destructive`        | `0 84% 60%`               | `0 72% 51%`               | Errors, deletion, danger alerts      |
| `--success`            | `142 71% 45%`             | `142 70% 45%`             | Positive trends, settled balances    |
| `--warning`            | `38 92% 50%`              | `38 92% 50%`              | Alerts, incomplete profile calls     |

---

## 3. Typography Scale & Font Architecture

### Font Families

- **Sans & UI:** `Inter`, `Geist`, system-ui fallback.
- **Display & Headings:** `Plus Jakarta Sans`, `Inter`.
- **Multilingual BiDi:**
  - **Arabic (`ar`):** `Readex Pro`, `Noto Sans Arabic`
  - **Urdu (`ur`):** `Noto Nastaliq Urdu`, `Amiri`
  - **Persian (`fa`):** `Vazirmatn`, `Noto Sans Arabic`

### Font Loading Strategy

- Fonts are configured with `font-display: swap` to prevent FOIT (Flash of Invisible Text).
- Critical preload is restricted to **one single font weight** (Inter Regular / 400 or Plus Jakarta Sans Medium) to avoid blocking initial network bandwidth. Non-critical weights are loaded lazily.
- Typographic hierarchy enforces `text-wrap: balance` on headings to prevent single-word orphan wrapping on small viewports.
- Legibility floor: Sub-xs microcopy enforces `--text-2xs: 0.75rem` (12px minimum floor) for Nastaliq and Arabic script legibility.

---

## 4. Spacing, Geometry & Touch Floor

- **Touch Target Floor:** All clickable elements (buttons, chips, inputs, pagination triggers) enforce `min-h-11 min-w-11` (44×44px minimum touch area).
- **Radius Tokens:** `--radius: 0.75rem` (12px base), `--radius-2xl: 1.5rem` (24px for modal and banner shells).
- **Logical Spacing (BiDi):** Spacing exclusively uses `ps-*`, `pe-*`, `ms-*`, `me-*`, and `text-start`/`text-end` to guarantee RTL mirroring without broken layouts.

---

## 5. Chart Visualization Guidelines (Recharts)

1. **Accessibility & Contrast:**
   - Charts must never rely on color alone to convey metrics; always pair tooltips, data labels, and accessible hidden summary tables (`sr-only`) for screen readers.
   - Gridlines use semantic borders: `stroke="hsl(var(--border))" strokeDasharray="3 3"`.
2. **Color Palette Mapping:**
   - Primary Series: `hsl(var(--primary))`
   - Secondary Series: `hsl(var(--secondary))`
   - Accent / Alert: `hsl(var(--warning))`
3. **Viewport Responsiveness:**
   - Chart containers must wrap in responsive aspect wrappers (`min-h-[180px]`) and avoid fixed pixel widths.
   - Legends wrap or collapse on mobile (`< 640px`) to preserve chart plot area.

---

## 6. Small-Screen Data Table Patterns

- **Desktop View:** Tabular columns with sortable headers, sticky table header, and row selection checkboxes.
- **Mobile View (< 640px):**
  - Horizontal scroll container (`overflow-x-auto`) with fixed first identifier column, or
  - Responsive Card Transformation (`DirectoryCard` pattern) stacking record details vertically into tappable 44px rows.
- **Empty States:** When a table has 0 records, render contextual empty states with a direct Call To Action button rather than a blank grid.
