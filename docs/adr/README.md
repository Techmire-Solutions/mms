# Architecture Decision Records

Canonical ADR journal — one decision per file, numbered `NNN-`. All Accepted &
Enforced unless noted. Open follow-ups live in [`../open-items.md`](../open-items.md).

| #   | Decision                                                                   | Status |
| --- | -------------------------------------------------------------------------- | ------ |
| 001 | [300-Line Code Ceiling & Proactive Modular Decomposition](./001-300-line-code-ceiling-and-proactive-modular-decomposition.md) | Accepted |
| 002 | [Strict Layer Decoupling (Presentation vs State Orchestration)](./002-strict-layer-decoupling.md) | Accepted |
| 003 | [Strict Type Safety & Runtime Zod Contracts at Boundaries](./003-strict-type-safety-and-runtime-zod-contracts.md) | Accepted |
| 004 | [Protected Infrastructure Zones & Authorization Guardrails](./004-protected-infrastructure-zones-and-authorization-guardrails.md) | Accepted |
| 005 | [Living Documentation Sync & Tri-Mirror Rule Topology](./005-living-documentation-synchronization-and-tri-mirror-topology.md) | Accepted |
| 006 | [Semantic Design Tokens & Design System Enforcements](./006-semantic-design-tokens-and-design-system-enforcements.md) | Accepted |
| 007 | [Mandatory Automated Verification Gates](./007-mandatory-automated-verification-gates.md) | Accepted |
| 008 | [Prepared Statements Modularization & Query Strict Typing](./008-prepared-statements-modularization-and-query-typing.md) | Accepted |
| 009 | [Prettier Owns Formatting](./009-prettier-owns-formatting.md) | Accepted |
| 010 | [Single Typed Escape Hatch for the ts-rest React-Query Client](./010-single-typed-escape-hatch-tsrest-react-query.md) | Accepted |
| 011 | [Backend Route→Storage Boundary](./011-backend-route-storage-boundary.md) | Accepted |
| 012 | [Canonical Date/Month Schemas & SSOT Idiom Guard](./012-canonical-date-month-schemas-and-ssot-guard.md) | Accepted |
| 013 | [Frontend Feature Isolation Across All Layers](./013-frontend-feature-isolation-across-all-layers.md) | Accepted |
| 014 | [Single `@mms/shared` Package & Mandatory DRY Reuse](./014-shared-package-and-dry-reuse.md) | Accepted |
| 015 | [Backend Ports & Adapters over `db/repositories/`](./015-backend-ports-and-adapters.md) | Accepted |
| 016 | [Two Frontend Data-Table Tiers (client-side `DataTable` vs server-driven directory)](./016-frontend-data-table-tiers.md) | Accepted |
| 017 | [Static Accessibility Gating (jsx-a11y error rules + E2E axe)](./017-static-accessibility-gating.md) | Accepted |

## Adding a record

Create `docs/adr/NNN-slug.md` using the newest number + 1, copy the
`Status / Date / Context / Decision / Consequences` shape, and add a row above.
