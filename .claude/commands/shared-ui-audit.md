---
description: Audit shared UI component compliance, ban cross-console duplicates, and verify zero orphaned imports
---

# /shared-ui-audit — Shared UI Architecture & Component Audit

Run the MMS **Shared UI Component Architecture & Governance Audit** workflow end to end.

1. Read `.agent/workflows/shared-ui-audit.md` and follow it exactly.
2. Owning rules are the norm SSOT (`rules/mms-dry.md`, `rules/mms-ui-ux-design.md`, `rules/mms-structure-naming.md`, `rules/mms-completion-review.md`) — the workflow is the procedure. If they disagree, the rule wins and the workflow needs fixing.
3. Report each step's outcome and the verification you actually ran (`mms-completion-review.md`).

Do not improvise a shorter path: the workflow encodes gates (pre-deletion typecheck/lint/build, ratchets, check:shared-ui) that exist precisely because skipping them has caused regressions.
