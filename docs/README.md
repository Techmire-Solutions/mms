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
- [messaging-ui-ux-audit-2026-10-24.md](./messaging-ui-ux-audit-2026-10-24.md) — Messaging module UI/UX audit + SSOT consolidation findings.
- [migration-milestones.md](./migration-milestones.md) — closed-milestone register.

## Engineering notes

- [engineering/](./engineering/) — frontend refactor plan/backlog + reuse audit, data-transfer.

## Plans

- [plans/](./plans/) — module/feature implementation plans.
- [superpowers/](./superpowers/) — dated Superpowers workflow plans & specs.

## Diagrams

- [diagrams/](./diagrams/) — `database-schema.html` (self-contained ERD).

## Archive

- [archive/](./archive/) — historical/superseded documents (kept for reference),
  including the point-in-time [platform UI ownership review](./archive/platform-ui-ownership-review.md).
