# MMS Auth & RBAC Security Matrix

**Rules SSOT:** `mms-auth-security.md` · `mms-data-layer.md` §5–§6

## RBAC Permission Checks by Surface

| Surface | Check | Notes |
|---------|-------|-------|
| `POST /api/db/collections/:name` | `canWriteCollection` | Legacy document store write |
| `POST /api/db/objects/:key` | `canWriteObject` | Legacy document store object write |
| `POST /api/db/reset` | `canResetTenantData` | Admin only |
| `GET /api/db/backup` | Admin + `canBulkSync` | REPEATABLE READ snapshot |
| `POST /api/db/sync` | `canBulkSync` + `bodyLimit` | Wipe-restore with `withSyncTimeout` |
| REST mutations `/api/students`, `/api/contacts` | `canWriteCollection` | Standard REST mutation |
| REST reads `/api/students`, `/api/contacts` | `canReadCollection` | Standard REST read |
| `DELETE /:id`, `POST /:id/restore` | `canDeleteCollection` | Soft-delete / trash lifecycle |
| REST list `?includeDeleted=true` | `canDeleteCollection` | Trash browser inspect |
| `/api/platform/*` | `platformUserCan` / `requirePlatformPermission` | Platform admin capabilities |

## Security Invariants

- **Session Invalidation on Soft-Delete**: Soft-deleting user or faculty accounts (`tenant_users`, `faculty`) must immediately revoke all active JWTs, refresh tokens, and Redis sessions. Authentication resolvers (`authenticateTenant`, `/me`, OAuth, credentials login) must verify `deleted_at IS NULL` (`mms-soft-delete`).
- **Hard-Delete Defense-in-Depth**: Blocked by PostgreSQL `forbid_hard_delete()` trigger. Privilege escalation via `SET LOCAL app.allow_hard_purge = 'true'` is restricted to retention purge workers.
- **GDPR Article 17 Erasure**: Dual-track: cryptographic shredding of KMS keys for encrypted data + in-place pseudonymization of plain PII attributes.
- **Audit Trails**: RFC 8785 canonical JSON outbox payloads, sharded cryptographic hash chains, `INSERT`-only DB privileges (`REVOKE UPDATE, DELETE`), MFA on audit reads (`mms-audit-trail`).
- **Trace Context Correlation**: W3C `traceparent` header propagated into `AsyncLocalStorage` and audit records as `correlation_id`.
