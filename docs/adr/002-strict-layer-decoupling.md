# ADR-002: Strict Layer Decoupling (Presentation vs State Orchestration)

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Coupling React JSX presentation with data fetching, server cache invalidation, business rule derivations, and side effects leads to brittle components and untestable UI.
- **Decision:**
  1. UI components must exclusively handle presentation and render state.
  2. All data fetching, caching, state orchestration, side effects, and calculations must be extracted into dedicated custom hooks, services, or repository adapters.
  3. Presentation sub-components receive clean, serializable props and emit event callbacks.
- **Consequences:** UI components can be tested in isolation using mock props; business logic can be tested without mounting full DOM trees.

---
