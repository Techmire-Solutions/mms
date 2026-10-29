---
name: mms-audit-trail
description: Implements or audits the database audit trail — RFC 8785 canonical JSON, sharded hash chains, crypto-shredding, monthly partitions, and outbox capture. Use when tracking entity mutations, compliance exports, or right-to-erasure events. Do NOT use for transient error logging (use Pino in mms-backend-api), soft-delete trash recovery (use mms-soft-delete), or financial invoice posting (use mms-finance-accounting).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-09-24
---

# MMS Modern Audit Trail Workflow

**Rules (norms SSOT):** `mms-data-layer.md` §5 · `mms-auth-security.md` §5 · `mms-core.md` · `mms-performance.md`. DDL migrations → `mms-schema-migrate`.

Enterprise guidelines for immutable, tamper-evident, privacy-compliant database audit trails across tenant workspaces and platform apex.

---

## Accounting evidence (advisory)

Read [ledger controls](../mms-finance-accounting/references/ledger-controls.md) for atomic business/audit evidence and [policy applicability](../mms-finance-accounting/references/policies-2026.md) for retention and erasure. Capture source event, original/correction links, operation identity, accounting date versus recording time, actor/approver, and policy version where supported. A hash chain proves neither authorization nor correct accounting, and it is not a substitute for the financial ledger.

Inspect actual triggers, privileges, outbox capture and verification jobs before claiming any control below is deployed. Archive timing, key scope, and retention are policy-dependent recommendations rather than universal legal requirements.

## When to use

- Designing or querying audit tables (`audit_trail_events`, `audit_verification_runs`, `audit_merkle_roots`)
- Writing entity state change tracking or transactional outbox capture hooks
- Cryptographic hash verification, Merkle tree rollups, or tamper-evidence checks
- Handling Right to Erasure / GDPR compliance without breaking cryptographic hash chains
- Setting up append-only database immutability rules (`INSERT`-only) and statement auditing

---

## 1. Five-Dimension Capture Model

Every audit event must capture five dimensions stored deterministically using **RFC 8785 (JSON Canonicalization Scheme - JCS)**:

| Dimension | Columns | Invariant |
|---|---|---|
| **Who** | `real_user_id`, `impersonated_user_id`, `ip_address`, `client_app`, `session_id` | Full actor identification; distinguishes actual user from impersonator. |
| **What** | `table_name`, `record_id`, `old_state`, `new_state` | Deterministic RFC 8785 state snapshots. Minimise at capture time (strip passwords, tokens, full PII). |
| **When** | `transaction_timestamp` | UTC microsecond precision (`clock_timestamp()`). |
| **Why** | `correlation_id`, `action_type`, `api_endpoint`, `http_method` | Correlates mutation to HTTP request or background job. Action types: `CREATE`, `UPDATE`, `DELETE`, `RESTORE`, `REDACT`. |
| **Integrity** | `hash_previous`, `hash_current`, `verification_status` | Cryptographic tamper-evidence (SHA-256 chain). |

---

## 2. Capture Patterns: Transactional Outbox

MMS uses an **Application-Level Outbox** pattern:
1. Always write audit events in the **exact same database transaction** as the primary business entity mutation (`withTenant(async (tx) => { ... })`).
2. If the transaction rolls back, no orphan audit rows exist; if it commits, the audit event is atomically persisted.
3. For soft-delete operations, use the existing outbox events `entity.soft_deleted` and `entity.restored`. Advisory: use a persisted sequence/version for ordering; `Date.now()` can collide or move backwards across workers and is not a monotonic business version.

---

## 3. Cryptographic Integrity & Hash Chains

### Chain verification
Use the deployed canonicalization, framing, algorithm version, shard identity and sequence when verifying a chain. Do not replace it with an ambiguous string-concatenation formula. Advisory: independently retained checkpoints and verification evidence strengthen tamper detection; a database administrator able to rewrite a whole unanchored chain remains a threat.
- For implementation pointers and compatibility cautions (not a replacement crypto implementation), see [`references/canonical-merkle.ts`](references/canonical-merkle.ts).
- For monthly range-partitioned DDL and append-only database triggers, see [`references/audit-partitions.sql`](references/audit-partitions.sql).

---

## 4. Right to Erasure (Crypto-Shredding)

The right to erasure has exceptions, including applicable legal retention obligations; it is not an instruction to erase financial evidence automatically. See the official ICO source in [policy applicability](../mms-finance-accounting/references/policies-2026.md).

Advisory procedure when erasure is applicable and authorized:
1. Establish the subject, retained-record obligations, legal holds, key dependencies, backups and authorized decision.
2. Prefer data minimization at capture. If crypto-shredding is supported, verify that the key is isolated to the intended subject/data; destroying a shared tenant key can erase unrelated required records.
3. Verify recoverability across key replicas/backups and ciphertext copies. Do not promise irreversible anonymization from deleting one key row.
4. Preserve immutable ciphertext/hash evidence according to the deployed chain protocol; append a redaction event without rewriting historical hashes. Verify the remaining chain and record the decision without reintroducing erased PII.

---

## 5. Storage Tiering & Database Immutability

1. **Partitioning:** Range-partition `audit_trail_events` by month (`transaction_timestamp`).
2. **Immutability:** Apply `trg_audit_trail_immutable` `BEFORE UPDATE OR DELETE` to guarantee append-only persistence.
3. **WORM Archival (advisory):** Choose archival timing, immutability settings and retention from the applicable policy; twelve months is not a universal requirement. Test retrieval and verification before detaching partitions.

---

## 6. Verification & Audit Acceptance Checklist

```bash
# Verify TypeScript type correctness across audit services
pnpm --filter mms-backend typecheck

# Run backend inject tests for audit and entity mutations
pnpm --filter mms-backend test
```

- [ ] All audit events are written within the same transaction as entity changes.
- [ ] Direct `UPDATE` or `DELETE` on `audit_trail_events` fails with `check_violation`.
- [ ] Hash chain links verify cleanly via SHA-256 against RFC 8785 canonical JSON.
- [ ] No passwords, credentials, or raw tokens are stored in `old_state` or `new_state`.

## Related skills

`mms-soft-delete`, `mms-backend-api`, `mms-schema-migrate`, `mms-finance-accounting`.
