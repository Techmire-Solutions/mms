# MMS Documentation

Index of everything under `docs/`. New documents must be added to this index
(enforced by `pnpm run check:docs`).

Project-wide entry points live at the repo root:
[README](../README.md) · [SYSTEM_ARCHITECTURE](../SYSTEM_ARCHITECTURE.md) ·
[AGENTS](../AGENTS.md) · [CONTRIBUTING](../CONTRIBUTING.md).

## Single sources of truth (current)

- [architecture.md](./architecture.md) — repository layout & layer boundaries.
- [soft-delete.md](./soft-delete.md) — soft-delete architecture.
- [faculty.md](./faculty.md) — Faculty module engineering spec (production gold standard).
- [engineering/data-transfer-import-export.md](./engineering/data-transfer-import-export.md) — import/export framework.
- [a11y-baseline.md](./a11y-baseline.md) — executable axe/WCAG gate baseline.
- [frontend-performance-baseline.md](./frontend-performance-baseline.md) — render-hygiene + React Compiler baseline.
- [dependencies-notes.md](./dependencies-notes.md) — dependency/tooling operational notes.
- [rls-operations.md](./rls-operations.md) — RLS role model, provisioning, deploy preflight, rollback.

## Decisions

- [adr/](./adr/) — Architecture Decision Records (canonical journal; one ADR per file).
- [open-items.md](./open-items.md) — open follow-ups recorded against the ADRs.

## Reference

- [Modern-Audit-Trail-Best-Practices.md](./Modern-Audit-Trail-Best-Practices.md) — audit-trail best practices (RFC 8785 etc.).

## Audits & reviews (point-in-time)

- [frontend-architecture-audit.md](./frontend-architecture-audit.md)
- [accounting-test-coverage-audit.md](./accounting-test-coverage-audit.md)
- [db-performance-audit.md](./db-performance-audit.md)
- [date-format-audit.md](./date-format-audit.md)
- [ui-ux-dry-ssot-review-2026-09-30.md](./ui-ux-dry-ssot-review-2026-09-30.md)
- [ui-ux-review.md](./ui-ux-review.md) · [ui-ux-review-resolution.md](./ui-ux-review-resolution.md)
- [ui-ux-review-2026-10-30/](./ui-ux-review-2026-10-30/) — rendered visual/UX review: localized date corruption, contacts table collapse, platform a11y gate red, mobile header/scroll, dashboard density. · [resolution](./ui-ux-review-2026-10-30/RESOLUTION.md)
- [ui-ux-review-2026-10-31/](./ui-ux-review-2026-10-31/) — fresh rendered review at `a7f22cfb5`: prior fixes re-verified, mobile integration-panel collapse, two new contrast exceptions, currency/numeral inconsistency, hidden row actions. · [resolution](./ui-ux-review-2026-10-31/RESOLUTION.md)
- [checkbox-audit-2026-11-01.md](./checkbox-audit-2026-11-01.md) — checkbox SSOT audit: fixed the form-checkbox double-toggle (Radix hidden input bubbling), hardened the primitive, added `CheckboxField`, and removed hand-rolled checkbox markup. · [resolution](./ui-ux-review-2026-10-31/RESOLUTION.md)
- [messaging-ui-ux-audit-2026-10-24.md](./messaging-ui-ux-audit-2026-10-24.md) — Messaging module UI/UX audit + SSOT consolidation findings.
- [project-review-2026-10-29.md](./project-review-2026-10-29.md) — whole-repo review: gates, test/build evidence, two fixed XSS vectors, open debt.
- [project-review-2026-10-30.md](./project-review-2026-10-30.md) — whole-repo re-review at `84516ad04`: 21/21 gates, 7,736 tests, production print/CSP regression, backend/shared coverage-basis gap, CI source-map disclosure; P-01–P-06 fixed in the same change.
- [backend-review-2026-10-29.md](./backend-review-2026-10-29.md) — backend deep-dive: audit-trail/RLS and finance-ledger defects, job/queue findings, deploy and authorization gaps.
- [backend-review-2026-10-30.md](./backend-review-2026-10-30.md) — post-hardening backend review: verification of F1–F46, 7-pillar audit, and adversarial evaluation.
- [backend-review-2026-10-31.md](./backend-review-2026-10-31.md) — independent backend re-review at `cf69f9d17`: two P0 finance `PUT` ledger bypasses, session/cache freshness failures, unbounded messaging jobs, and audit gaps on restore and batch billing.
- [frontend-review-2026-10-30.md](./frontend-review-2026-10-30.md) — frontend deep-dive: PWA precache budget, stale-chunk recovery, pre-paint BiDi, coverage depth, deferred i18n split.
- [frontend-review-2026-10-30-deep.md](./frontend-review-2026-10-30-deep.md) — whole-frontend review: routing/data/a11y/i18n findings, 12 fixes (pagination labels, settings deep links, palette focus trap, finance live push, 401 escalation, platform boundary), deferred register.
- [rules-review-2026-10-29.md](./rules-review-2026-10-29.md) — agent standards review: rule findings H/M/L, per-rule scorecard, 49-skill review + fixes, and the DeepSeek Harness `.dsh` mirror.
- [migration-milestones.md](./migration-milestones.md) — closed-milestone register.

## Engineering notes

- [engineering/](./engineering/) — frontend refactor plan/backlog + reuse audit, data-transfer.
- [timestamp-migration.md](./timestamp-migration.md) — naive timestamp inventory + per-table migration playbook.

## Plans

- [plans/](./plans/) — module/feature implementation plans.
- [superpowers/](./superpowers/) — dated Superpowers workflow plans & specs.

## Diagrams

- [diagrams/](./diagrams/) — `database-schema.html` (self-contained ERD).

## Archive

- [archive/](./archive/) — historical/superseded documents (kept for reference),
  including the point-in-time [platform UI ownership review](./archive/platform-ui-ownership-review.md).
