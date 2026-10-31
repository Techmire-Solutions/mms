# ADR-018: Audit verification anchoring and dedicated audit permissions

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Backend/platform maintainers

## Context

The backend review (2026-10-29) found two structural gaps in the audit trail:

1. Verification of a tenant shard always started at `GENESIS` and never compared the
   computed head to a published Merkle checkpoint. A legitimately detached monthly partition
   therefore produced a permanent false `BROKEN_CHAIN`, while truncating the newest events
   produced a false `VERIFIED`. Rows also stamped themselves `VERIFIED` at insert.
2. Audit governance reused `analytics.view` — a dashboard read held by every default teacher —
   for reading the security log and for irreversible erasure/retention operations.

## Decision

1. **Verification runs are anchored.** `audit_verification_runs` records the `from_*` / `to_*`
   head it verified. A run resumes strictly after the previous run's head; when that anchor row
   is no longer visible (archived partition) the run continues from the last known hash and
   records `anchored = false` instead of reporting a false break. The walk must pass through the
   latest published `audit_merkle_roots.heads[tenant]` or reports `CHECKPOINT_NOT_IN_CHAIN`.
2. **Rows never self-assert verification.** New events are inserted as `PENDING`; the run table
   is the source of truth for integrity status.
3. **Audit is its own RBAC module** (`audit`) with `audit.view` and `audit.manage`. Read/verify/
   export require the former; erasure, retention purge and checkpoints require the latter.
   Admin/super-admin inherit both; the default `auditor` role gets read-only; teachers do not.
4. **Subject state is encrypted at capture** for person records (`subjectId`), so destroying the
   subject key makes the stored audit state unreadable without rewriting hashes. Historical
   plaintext rows are not retro-encrypted.
5. **Audit writes are transactional.** `recordModernAuditEvent` joins the caller's transaction
   or opens a tenant transaction, and destructive flows (restore/reset) audit inside the same
   transaction.

## Consequences

- Verification is stateful; the first run on an existing deployment starts at `GENESIS` once and
  becomes incremental afterwards.
- Read-side audit events (VIEW/EXPORT) remain best-effort so a log failure cannot hide data;
  mutation audits throw and roll back with the business write.
- The `audit` permission row appears in the role editor; granting it is an admin decision.
- Legacy crypto/erasure rows without a workspace remain invisible to tenant traffic until an
  operator cleans them.
