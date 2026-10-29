# MMS Encrypted Backup & Restore Specification

This document details the cryptographic envelope format, KDF key derivation, safety pre-wipe validation protocol, and restore rollback procedures.

---

## 1. Cryptographic Envelope Specification

Backup archives in MMS are encrypted client-side using industry-standard authenticated encryption:

- **Cipher:** AES-256-GCM (Galois/Counter Mode with 128-bit authentication tag).
- **Key Derivation Function (KDF):** PBKDF2 with SHA-256 (minimum 100,000 iterations).
- **Core Library:** `packages/shared/src/backup/backupCrypto.ts`
- **Envelope Schemas:** `packages/shared/src/backup/backupSchemas.ts`

### Envelope Structure
```json
{
  "format": "mms-backup-envelope-v1",
  "version": 1,
  "kdf": {
    "algorithm": "PBKDF2",
    "hash": "SHA-256",
    "iterations": 100000,
    "salt": "<hex-encoded-salt-32-bytes>"
  },
  "cipher": {
    "algorithm": "AES-GCM",
    "iv": "<hex-encoded-iv-12-bytes>",
    "tagLength": 128
  },
  "metadata": {
    "workspaceId": "ws-demo",
    "exportedAt": "2026-10-16T00:00:00.000Z",
    "appVersion": "2.1.0",
    "entities": ["contacts", "students", "faculty", "settings"]
  },
  "ciphertext": "<base64-encoded-ciphertext-and-tag>"
}
```

---

## 2. Safety Pre-Wipe Validation Protocol

Before any database wipe or restore sequence begins, the system executes four mandatory safety gates (`apps/backend/src/services/dbSyncRestoreService.ts`):

1. **Safety Backup:** The server generates and persists a temporary snapshot (`safety_backup_<timestamp>.enc`) of current workspace state.
2. **Envelope Schema Validation:** `backupValidationUtils.ts` validates that the uploaded file matches `mms-backup-envelope-v1` schema and passes checksum integrity.
3. **Decryption Probe:** A test decrypt verifies the supplied passphrase decrypts the payload without GCM tag mismatch before any database tables are modified.
4. **Restore Mutex Lock:** `apps/backend/src/lib/restoreLock.ts` acquires an exclusive lock preventing concurrent tenant operations or API requests during the restore sequence.

---

## 3. Transactional Restore & Rollback

- **Single Transaction:** Restore executes inside `withTenant` within a top-level `runInTransaction`.
- **Topological Ingestion:** Records are inserted topologically (workspaces → users → contacts → faculty/students → sessions → enrollments).
- **Timeout Rollback:** If the restore process exceeds `PG_STATEMENT_TIMEOUT_MS` or connection drops, the transaction aborts automatically, leaving the prior workspace state completely untouched.

---

## 4. Verification

```bash
# Test backup crypto and envelope serialization
pnpm --filter @mms/shared test packages/shared/src/backup/backupCrypto.test.ts

# Test backend restore service
pnpm --filter mms-backend test apps/backend/src/__tests__/backupAssetService.test.ts
```
