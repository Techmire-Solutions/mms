# ADR-012: Canonical Date/Month Schemas and SSOT Idiom Guard

- **Status:** Accepted & Enforced
- **Date:** 2026-10-12
- **Context:** `isoDateSchema` existed to replace shape-only `/^\d{4}-\d{2}-\d{2}$/` checks (which accept impossible dates such as `2026-02-31`), yet inline copies drifted into several modules; nine identical `monthKey` regexes and two strict `YYYY-MM` billing-period regexes were duplicated, and a canonical `widgetAggregateResultSchema` was re-declared in three contracts.
- **Decision:**
  1. `isoDateSchema`, `monthKeySchema` and `billingPeriodSchema` are the only definitions of those date/month rules.
  2. Canonical schemas (e.g. `widgetAggregateResultSchema`) have a single definition; contracts import them.
  3. The shared SSOT auditor fails any inline `z.string().regex(/^\d{4}-…` outside the canonical files, and any contract that re-declares a canonical schema.
- **Consequences:** One definition per rule; drift is machine-caught. Two deliberate tightenings: faculty/tasks/accounting ISO-date fields now reject impossible dates, and the accounting fee/pay period message is unified.

---
