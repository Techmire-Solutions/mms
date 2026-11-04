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
- [automatic-role-tagging.md](./automatic-role-tagging.md) — Student/Faculty role-to-contact tag projection: sources, archival, read-only enforcement, backfill, and the hourly date sweep.
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

- [ui-ux-review-2026-11-04/](./ui-ux-review-2026-11-04/) — rendered UI/UX pass over Dashboard, Contacts, Students, Faculty, Tasks at `30abb1b41`: Tasks table collapse at 768–1024, truncated KPI labels, mobile tier headers below content, wide-table overflow, task status/dirty-close defects, failed-metric skeletons, six critical/serious axe findings; 85 captures, 35 curated screenshots.
- [backend-module-review-2026-11-04-round2.md](./backend-module-review-2026-11-04-round2.md) — independent backend verification across Dashboard, Contacts, Students, Faculty, Tasks: 3 Critical (dashboard auditor write/delete, faculty dead session guard, faculty restore/trash unreachable), 28 Major (contacts PII/merge/OCC, student import/enrollment/export, faculty hierarchy/temporal SSOT, tasks ownership/notifications/export); 390/2,650 unit and 59/235 DB tests pass; RLS suite not run under `postgres`; corrects the earlier "production-grade" summary.
- [backend-module-review-2026-11-04.md](./backend-module-review-2026-11-04.md) — earlier summary across the same five modules; its "no Critical / production-grade" claims are corrected by the independent round-2 review above (RLS runtime unproven, faculty hierarchy stubs, contacts PII defaults, tasks ownership/notification gaps).
- [frontend-module-review-2026-11-04.md](./frontend-module-review-2026-11-04.md) — consolidated frontend pass over Dashboard, Contacts, Students, Faculty, Tasks at `30abb1b41`: metrics-failure zeros, widget/prefs hydration, drawer field gating, OCC recovery, Faculty blank-tier/filter defects, Tasks reports/row-click, and shared Setup-draft/pagination/import gaps; 7/7 focused axe sweeps passed.
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
- [messaging-module-review-2026-11-04.md](./messaging-module-review-2026-11-04.md) — messaging module review at `44871c86c`: payload-derived idempotency key silently dropped repeat campaigns, direct dispatch re-sent on retry, archived logs unreachable (`includeDeleted` no-op), clear/restore audit not atomic, and selection outliving its view. Second pass: batched delivery outcomes, `sending` status taxonomy, dead log-path removal, keyboard/shortcut scoping, composer prefill, archived-log DB proof.
- [project-review-2026-10-29.md](./project-review-2026-10-29.md) — whole-repo review: gates, test/build evidence, two fixed XSS vectors, open debt.
- [project-review-2026-10-30.md](./project-review-2026-10-30.md) — whole-repo re-review at `84516ad04`: 21/21 gates, 7,736 tests, production print/CSP regression, backend/shared coverage-basis gap, CI source-map disclosure; P-01–P-06 fixed in the same change.
- [backend-review-2026-10-29.md](./backend-review-2026-10-29.md) — backend deep-dive: audit-trail/RLS and finance-ledger defects, job/queue findings, deploy and authorization gaps.
- [backend-review-2026-10-30.md](./backend-review-2026-10-30.md) — post-hardening backend review: verification of F1–F46, 7-pillar audit, and adversarial evaluation.
- [backend-review-2026-10-31.md](./backend-review-2026-10-31.md) — independent backend re-review at `cf69f9d17`: two P0 finance `PUT` ledger bypasses, session/cache freshness failures, unbounded messaging jobs, and audit gaps on restore and batch billing.
- [contacts-module-review-2026-11-02.md](./contacts-module-review-2026-11-02.md) — contacts domain review at `ef994f0f9`: racy optimistic concurrency, unencrypted PII in delete/restore audit snapshots, stale child rewrites on bulk tag, and two field-visibility bypasses.
- [contacts-module-review-2026-11-02-addendum.md](./contacts-module-review-2026-11-02-addendum.md) — deep-dive addendum: messaging recipient list exposes full contact records under `messaging.read` (P1), recipient field-permission bypass, legacy root-upload tenant gap, attachment orphans, and duplicate-cache staleness.
- [contacts-module-review-2026-11-02-round2.md](./contacts-module-review-2026-11-02-round2.md) — independent round-2 review at `e7fd7134b`: all 21 prior findings re-verified, one P1 (sorted CSV export silently truncates rows), CSV import and >500 VCF export failures, relationship-field loss, quadratic duplicate scan, unstable pagination, picker 403s for staff roles, and an inert soft-delete RLS policy.
- [contacts-module-review-2026-11-03.md](./contacts-module-review-2026-11-03.md) — round-3 review at `e7ebcbb63`: all 12 round-2 P1/P2s re-verified; new automatic role tags, picker and pre-migration audited; 3 P2s (pre-migration tag loss, contact version/attribution rewrite, stale batch role tags) and 8 P3s.
- [contacts-module-review-2026-11-03-round4.md](./contacts-module-review-2026-11-03-round4.md) — round-4 review at `7309bc97c`: write path, shared contracts, upload authorization and the frontend tiers audited; 9 P1s (merge failing on the dropped `faculty.contact_id`, absent-collection data loss on edit/merge/re-import, OCC bypass on merge and POST, invisible-row selection, fabricated drawer contact, non-converging offline replay, ungated attachment downloads) fixed in the same change, plus the P2/P3 backlog.
- [students-module-review-2026-11-03.md](./students-module-review-2026-11-03.md) — students domain review at `38b0f8f9f`: CSV import wired to a missing job runner, create upserting by client `id` (unauthorized resurrect), bulk status skipping enrollment withdrawal, an orphaned server-side validation layer, and status-blind frontend writes.
- [students-module-review-2026-11-04.md](./students-module-review-2026-11-04.md) — re-review at `ab9874cab`: student export silently truncated to its first page, client-forgeable `createdAt`, pre-commit cache eviction, selection outliving its directory view, and the unimplemented `age` report field.
- [students-module-review-2026-11-04-round3.md](./students-module-review-2026-11-04-round3.md) — round-3 review at `60245210a`: #275 fixes re-verified; import retries duplicate students, `bulk-enroll` bypasses the enrollments gate, a settings-read failure disables blueprint validation, and bulk-restore audit rows cover rows the DB did not restore.
- [contacts-module-review-2026-11-04-round5.md](./contacts-module-review-2026-11-04-round5.md) — round-5 review at `60245210a`: rounds 3–4 hold; merging a CNIC-only-on-the-loser duplicate aborts with a false 400, the dependent-link 409 becomes a 500, offline upsert replay never sends the OCC token, and nine route 500s are unlogged.
- [faculty-module-review-2026-11-04-round2.md](./faculty-module-review-2026-11-04-round2.md) — round-2 review at `60245210a`: #276 fixes re-verified; faculty save rewrites the linked user's RBAC role without an actor check (escalation/demotion), both soft-delete session guards query the wrong key, and every delete/restore route resolves a `write` action.
- [dashboard-module-review-2026-11-04.md](./dashboard-module-review-2026-11-04.md) — first dashboard review at `60245210a`: prefs/widgets are a workspace singleton, no optimistic/OCC write path, partial PUT resets omitted preferences, widget DTO is looser than its varchar columns, and permission-denied metric cards render as zeros.
- [tasks-module-review-2026-11-04.md](./tasks-module-review-2026-11-04.md) — first tasks review at `60245210a`: CSV export/import enqueue runners that were never registered, the directory only ever loads the first 50 rows, `delegationScope` is stored but unused, any writer can mutate/unassign any task, assignment notifications reach nobody, and the status badge reopens completed work.
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
