# Zero-Downtime Expand/Contract Schema Migrations

This guide details the expand/contract database evolution pattern, lock-safe concurrent indexing, and PostgreSQL Row-Level Security (RLS) enforcement in MMS.

---

## 1. The Expand/Contract Lifecycle

To deploy database schema changes without downtime or backward-incompatible breaks:

### Phase 1: Expand
- Add the new column as `NULLABLE` (or with a safe default).
- Do NOT drop or rename existing columns.
- Update backend services to write to both old and new columns, reading from the old column.

```sql
ALTER TABLE students ADD COLUMN full_legal_name VARCHAR(255);
```

### Phase 2: Backfill
- Run an asynchronous backfill script or background worker to populate the new column for existing historical rows.
- Verify 100% data parity between old and new columns.

### Phase 3: Contract
- Switch backend service to read exclusively from the new column.
- Apply `NOT NULL` constraint using a lock-safe check constraint or validation pattern:
  ```sql
  ALTER TABLE students ADD CONSTRAINT students_legal_name_not_null CHECK (full_legal_name IS NOT NULL) NOT VALID;
  ALTER TABLE students VALIDATE CONSTRAINT students_legal_name_not_null;
  ```
- Drop the deprecated old column in a subsequent release after confirming no callers reference it.

---

## 2. Lock-Safe Index Creation

Standard `CREATE INDEX` acquires an `ACCESS EXCLUSIVE` lock on the target table, blocking all writes.
- In production migrations, write-blocking indexes are strictly banned (`check:migration-indexes`).
- Create indexes concurrently outside the transaction block:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_tenant_gr_number
  ON students (tenant_id, gr_number)
  WHERE deleted_at IS NULL;
```

---

## 3. Mandatory Tenant RLS Enforcement

Every new tenant table MUST have Row-Level Security enabled and forced:

```sql
ALTER TABLE my_tenant_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_tenant_table FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON my_tenant_table
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
```
