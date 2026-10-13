# ADR-013: Frontend Feature Isolation Across All Layers

- **Status:** Accepted & Enforced
- **Date:** 2026-10-12
- **Context:** `no-cross-feature-imports` only constrained importers inside `src/tenant/features/**`, so shared-layer modules (`hooks/`, `components/`, `lib/`, `tenant/hooks/`) still reached into feature internals.
- **Decision:**
  1. Feature→feature imports stay banned (`reports`/`settings` are sanctioned cross-cutting targets).
  2. The same rule now also bans shared-layer → feature imports, so those layers consume `@/tenant/hooks/collections/*` facades.
  3. Sanctioned bridges are enumerated in `feature-internal-imports-baseline.json` (four entries) with a `stale` check; route wiring (`lib/routing/**`) and `components/ui|common` stay out of scope.
- **Consequences:** The layering contract is enforced everywhere; the four remaining bridges are visible and must be justified.
