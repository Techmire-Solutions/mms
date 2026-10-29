# MMS BiDi Layout Tokens & Directional Refactoring Reference

**Rules SSOT:** `mms-ui-ux-design.md` · `mms-structure-naming.md`

## Physical vs Logical Class Mapping

| Physical Property (BANNED ❌) | BiDi Logical Property (REQUIRED ✅) |
|---|---|
| `pl-*`, `pr-*` | `ps-*`, `pe-*` (padding-inline-start / end) |
| `ml-*`, `mr-*` | `ms-*`, `me-*` (margin-inline-start / end) |
| `left-*`, `right-*` | `start-*`, `end-*` (inset-inline-start / end) |
| `text-left`, `text-right` | `text-start`, `text-end` |
| `border-l-*`, `border-r-*` | `border-s-*`, `border-e-*` |
| `rounded-l-*`, `rounded-r-*` | `rounded-s-*`, `rounded-e-*` |
| `scroll-pl-*`, `scroll-pr-*` | `scroll-ps-*`, `scroll-pe-*` |

## Directional Icons & Mirroring
- Directional icons (arrows, chevrons, back/forward) must follow their semantic direction; use `rtl:rotate-180` for horizontal back/forward icons. Do not rotate up/down arrows merely because the locale is RTL.
- Symmetrical icons (search, user, settings, calendar) must NOT be rotated.

## Font Stacks by Locale & Vertical Metrics
- **Arabic / Persian**: `font-[family-name:var(--font-arabic)]` / `Cairo` / `Readex Pro`.
- **Urdu**: `font-[family-name:var(--font-urdu)]` / `Noto Nastaliq Urdu` with mandatory `line-height: 2.2` and safe vertical padding to prevent diacritic and vowel mark clipping.

## Modern Typography & Text Wrapping (2026)
- **Headings & Titles**: Apply `text-wrap: balance` on headers, card titles, and modal titles to ensure optically balanced, aesthetic line breaks.
- **Body & Descriptions**: Apply `text-wrap: pretty` on paragraphs, helper text, and alerts to prevent typographic orphan words at line ends.
- **Mixed-Script Text Isolation**: Advisory: isolate free-form names/notes with `bdi` or `dir="auto"` where appropriate. Phone numbers and stable machine identifiers may require explicit `dir="ltr"` inside an isolated span; test prefixes and parentheses instead of assuming auto-direction handles every value.
