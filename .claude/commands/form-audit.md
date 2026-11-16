---
description: Inventory and audit every form surface, fix lifecycle/collection/UI/i18n/a11y defects, and close with the full form regression gate
---

# /form-audit — Form Architecture Audit & Remediation

Run the MMS **Form Architecture Audit & Remediation** workflow end to end.

1. Read `.agent/workflows/form-audit.md` and follow it exactly.
2. Owning rules are the norm SSOT (`rules/mms-form-architecture.md`, `rules/mms-dry.md`,
   `rules/mms-shared-ui.md`, `rules/mms-ui-ux-design.md`, `rules/mms-settings-i18n.md`,
   `rules/mms-completion-review.md`) — the workflow is the procedure. If they disagree, the
   rule wins and the workflow needs fixing.
3. Start from `pnpm run forms:inventory` (never hand-write the manifest) and record findings
   in `docs/forms-audit-2026-11-16.md`.
4. The shell contract is `FormModal` with `saving` / `saveDisabled` / `error` / `isDirty`.
   Do not invent `isSubmitting`, `isOpen`, or `onSubmit` props.
5. Report each phase's outcome and the verification you actually ran (`mms-completion-review.md`).

Do not improvise a shorter path: the workflow encodes the gates (inventory drift, ratchet
baselines, i18n/BiDi/a11y, pre-PR) that exist because form regressions are silent.
