# ADR-006: Semantic Design Tokens and Design System Enforcements

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Hardcoded hex color codes and arbitrary pixel spacing produce inconsistent themes, break dark mode, and degrade accessibility.
- **Decision:**
  1. All UI components must consume semantic design tokens defined in Tailwind CSS v4 and `index.css` `@theme` (`primary`, `secondary`, `destructive`, `success`, `muted`, `accent`, `card`, `popover`).
  2. Raw hex colors outside `@theme` are forbidden and ratcheted via `scripts/check-code-norms.mjs`.
  3. All layouts must use BiDi logical properties (`ms-`, `me-`, `start-`, `end-`) to guarantee bidirectional RTL/LTR support for Arabic and Urdu.
- **Consequences:** Cohesive visual identity, dynamic tenant brand theming, accessible contrast ratios, and flawless BiDi rendering.

---
