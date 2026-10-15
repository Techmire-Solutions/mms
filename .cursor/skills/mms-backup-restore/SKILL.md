---
name: mms-backup-restore
description: Implements or audits workspace encrypted backup/export and wipe-restore — safety backup, validate-before-wipe, KDF/envelope, sync timeout rollback. Use when modifying BackupRestore UI, /api/db/backup or /api/db/sync, backup crypto, or restore safety gates. Do NOT use for raw PostgreSQL ops dumps (use mms-ops-deploy), general application settings/i18n (use mms-settings-i18n), or collection sync primary path (use mms-data-sync).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Backup & Restore Workflow

**Rule (norms SSOT):** `mms-settings-i18n.mdc` · `mms-data-layer.mdc` §6 · `mms-auth-security.mdc`.
**Workflows:** `/code-review` · **Manifest:** `.agent/skills-manifest.json`

## When to use

- Changing BackupRestore UI, `/api/db/backup`, or `/api/db/sync`
- Touching backup crypto or wipe-restore safety gates

## Accounting restore acceptance

Advisory: apply [closing and reporting](../mms-finance-accounting/references/closing-reporting.md) to validate complete journal headers/lines, exact control totals, account/fiscal references, source uniqueness, opening/closing identity, posted/closed state, and attachment provenance before and after restore.

A backup restore is not a mechanism for editing posted journals or reopening periods. Preserve source IDs so workers/provider events do not post twice after recovery. Keep audit history and retention/legal-hold decisions distinct from ordinary data replacement. An encrypted envelope proves neither a balanced ledger nor restoration completeness; verify both in an isolated restore test.

## Anti-Patterns & Banned Operations

- ❌ **NEVER execute wipe without dry-run validation**: Always validate snapshot integrity and schema conformance before purging existing data.
- ❌ **NEVER commit a partial restore**: Entire wipe-restore sequence must run within an atomic transaction with timeout rollback.
- ❌ **NEVER truncate or alter audit trail events**: Restore operations must append an immutable audit record (`action_type = 'RESTORE'`).
- ❌ **NEVER restore across tenant boundaries**: Reject backup files immediately if snapshot subdomain does not match current tenant session.

## Two-Step Wipe-Restore Implementation Pattern

```ts
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function executeWipeRestoreTransaction(tenantSubdomain: string, snapshotData: ValidatedSnapshot) {
  return await db.transaction(async (tx) => {
    // 1. Enforce tenant isolation & bypass hard-delete triggers for pre-existing records
    await tx.execute(sql`SET LOCAL app.current_tenant = ${tenantSubdomain}`);
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);

    // 2. Validate dry-run snapshot schema conformance
    validateAndNormalizeSnapshot(snapshotData);

    // 3. Purge pre-existing tenant records safely
    await purgeTenantEntitiesForRestore(tx, tenantSubdomain);

    // 4. Insert restored entities with historical audit timestamps
    await insertRestoredEntities(tx, snapshotData);

    // 5. Append immutable audit trail event
    await tx.execute(sql`
      INSERT INTO audit_trail_events (workspace_subdomain, action_type, table_name, details)
      VALUES (${tenantSubdomain}, 'RESTORE', 'workspace_snapshot', '{"status":"success"}')
    `);
  });
}
```

## Verification Checklist

```
- [ ] Two-step UI gate intact (password step-up + mandatory safety backup)
- [ ] Subdomain check rejects foreign tenant backups before decryption prompt
- [ ] Validate-before-wipe ensures zero partial-commit failures
- [ ] Wipe transaction executes under SET LOCAL app.allow_hard_purge = 'true'
- [ ] Audit trail preserved without truncation; RESTORE action appended
- [ ] Run: pnpm typecheck && cd apps/backend && pnpm test
```

## References

- Encrypted Backup Envelope & Restore Protocol: `references/backup-crypto-envelope.md`

## Related skills

`mms-data-sync`, `mms-backend-security`, `mms-ops-deploy`.
