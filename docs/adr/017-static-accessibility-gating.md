# ADR-017: Static accessibility gating (jsx-a11y error rules + E2E axe)

- **Status:** Accepted
- **Date:** 2026-10-13
- **Deciders:** Frontend/platform maintainers

## Context
The frontend ships a large React surface. Accessibility was enforced only at runtime by the
E2E axe sweep (`e2e/tests/a11y/*` → `assertNoSeriousA11yViolations`), while the static
`jsx-a11y` ESLint preset sat entirely at `warn` — so `pnpm lint` (which runs `--quiet`, errors
only) gated nothing and a no-cache `eslint .` reported 146 findings.

Triage showed the backlog splits cleanly in two:

- **Behaviour-neutral** findings — the fix only corrects ARIA/DOM metadata (redundant roles,
  unsupported/required ARIA props, missing labels, invalid role values) with no UX change.
- **Interaction** findings — the fix changes DOM structure or focus behaviour, and the backlog
  is dominated by deliberate, correct patterns: keyboard-scrollable `role="region"`
  containers (`tabIndex={0}`), programmatic focus targets (`tabIndex={-1}`), modal/field
  `autoFocus`, and pointer-only canvas/row affordances.

## Decision
1. **Gate the behaviour-neutral rules at `error`** in `apps/frontend/eslint.config.js`:
   `jsx-a11y/role-supports-aria-props`, `role-has-required-aria-props`, `no-redundant-roles`,
   `control-has-associated-label`, `aria-role`. These are semantics-only and now fail CI via
   `pnpm lint`.
2. **Exempt test files** (`**/*.test.tsx`, `**/*.spec.tsx`) from the jsx-a11y block — they
   render real components but are not shipped UI, mirroring the existing test-exemption block.
3. **Keep the interaction rules at `warn`** (`no-autofocus`,
   `click-events-have-key-events`, `no-static-element-interactions`,
   `no-noninteractive-element-interactions`, `no-noninteractive-tabindex`,
   `interactive-supports-focus`, `*-to-*-role`). Promoting them would require unjustified
   disables for correct patterns, or behaviour-changing DOM rewrites.
4. **The E2E axe sweep remains the runtime a11y gate** for everything (structure, contrast,
   focus, RTL). Any future promotion of an interaction rule must pair the fix with an E2E
   verification, not a lone `eslint-disable`.

## Consequences
- ARIA/semantic regressions now fail static lint in CI; interaction-level a11y is caught at
  runtime by axe.
- The remaining `warn` backlog is a curated list of intentional patterns, not debt — do not
  “fix” them without a product decision and E2E coverage.
- Where a rule genuinely misfires on a correct pattern, prefer a narrowly-scoped, justified
  `eslint-disable-next-line` over weakening the rule.
