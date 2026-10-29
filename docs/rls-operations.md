# RLS operations — provisioning, verification, rollback

The backend is written for defence in depth: every tenant table carries
`ENABLE` + `FORCE ROW LEVEL SECURITY`, transactions set `app.current_tenant`
(`withTenant`), and the application predicates scope every query as well.

RLS only protects data when the **runtime role does not bypass it**. PostgreSQL
exempts superusers and `BYPASSRLS` roles from every policy, so a `DATABASE_URL`
that still points at `postgres` makes all 200+ policies decorative. The boot
guard ([`rlsRoleGuard.ts`](../apps/backend/src/db/rlsRoleGuard.ts)) refuses to
start in `strict` mode when that happens.

## 1. Check the current role

```bash
cd apps/backend
DATABASE_URL=... MMS_DB_ROLE_ENFORCEMENT=strict pnpm run db:check-rls
```

Exit `0` means the role is subject to RLS. Exit `1` prints the SQL remediation
(create `mms_app`, point `DATABASE_URL` at it). `--json` is available for logs.

`MMS_DB_ROLE_ENFORCEMENT`:

| Mode | Behaviour |
| --- | --- |
| `strict` | Refuse to start when the role bypasses RLS (production target). |
| `warn` | Log an error and continue (temporary rollout / emergency). |
| `off` | Skip the check (single-tenant, intentional exception). |

## 2. Provision `mms_app` on an existing database

Fresh docker-compose installs create `mms_app` before any table exists. For a
database created by `postgres`, the app role must also **own** the existing
objects or migrations cannot run DDL.

```bash
# 1. Back up first (the ownership transfer takes DDL locks).
bash scripts/production/backup-postgres.sh

# 2. Dry-run: prints how many objects would be reassigned.
cd apps/backend
ADMIN_DATABASE_URL=postgres://postgres@localhost:5432/mms \
MMS_DB_PASSWORD='<new-role-password>' \
node --experimental-strip-types src/scripts/provisionRlsRole.ts --dry-run

# 3. Apply (maintenance window; idempotent).
ADMIN_DATABASE_URL=postgres://postgres@localhost:5432/mms \
MMS_DB_PASSWORD='<new-role-password>' \
node --experimental-strip-types src/scripts/provisionRlsRole.ts
```

The script creates/updates `mms_app (NOSUPERUSER NOBYPASSRLS)`, installs
`btree_gist`/`pg_trgm` as the admin, makes `mms_app` the database owner, and
reassigns the `public` and `drizzle` objects (tables, sequences, views,
matviews, functions, enum/domain types). Extension-owned objects are left with
the admin so `ALTER/DROP EXTENSION` keeps working.

Then update `apps/backend/.env`:

```dotenv
DATABASE_URL=postgresql://mms_app:<password>@<host>:5432/mms
MMS_DB_ROLE_ENFORCEMENT=strict
```

Run migrations once as the new role, then verify:

```bash
cd apps/backend
pnpm run db:migrate
pnpm run db:check-rls
```

## 3. Deploy preflight

`scripts/deploy-on-server.sh` runs `checkRlsRole` and the mode policy **before
migrations and before the PM2 reload**. A failing check exits 1 and the previous
release keeps serving.

The env is snapshotted before the merge. On any failed deploy the script restores
that snapshot, and a preflight failure leaves a `.deploy-preflight-failed`
marker that makes the automatic rollback skip its PM2 reload — the running
release is already unchanged. Without this, a rollback would reload the previous
code with the failed deploy's new env (e.g. `strict`) and could take the site
down. Each successful release also saves its `.env` as
`.deploy-releases/<sha>.env`; a rollback restores that release's env before
reloading.

`MMS_DB_ROLE_ENFORCEMENT` defaults to `strict` in the deploy workflow, the env
merge, and the on-server fallback. `warn`/`off` are rejected unless explicitly
overridden for that deploy:

```bash
MMS_ALLOW_RLS_WARN=1   # temporary, documented exception
MMS_ALLOW_RLS_OFF=1    # intentional single-tenant installs
```

The overrides are per-deploy and are not written to `.env`; remove them after
use. The GitHub deploy workflow passes them (default `0`) alongside
`MMS_DB_ROLE_ENFORCEMENT` (default `strict`).

### Pre-deploy checklist

1. Run section 2 on the target host; confirm `db:check-rls` prints
   `rls_applies=true` with `mode=strict`.
2. Set the GitHub `MMS_DB_ROLE_ENFORCEMENT` variable to `strict` or remove it
   so the workflow default applies. Keep `MMS_ALLOW_RLS_WARN`/`OFF` at `0`.
3. Deploy; the preflight logs the connected role and the mode.
4. If it aborts, the running release is still serving: provision the role and
   redeploy, or use the documented override briefly.
5. Roll back with section 5 if anything fails.

## 4. CI proof

`test-backend-rls` provisions `mms_app` in the Postgres service, migrates as it
with `strict`, and runs `src/__tests__/rls/**` via `pnpm run test:rls`. The suite
fails loudly when connected as a bypassing role, so a green run always means RLS
was actually active. It covers cross-tenant reads, the no-tenant outside-
transaction case, document-template CRUD, the audit shard head, and the Merkle
head projection.

## 5. Rollback

No data migration is involved. To return to the old behaviour:

1. Set `MMS_DB_ROLE_ENFORCEMENT=warn` **and** `MMS_ALLOW_RLS_WARN=1`.
2. Redeploy (preflight warns instead of aborting).
3. Investigate; do not leave `warn` in place indefinitely — the boot guard only
   logs, so RLS is off while it is set.

`scripts/deploy-rollback.sh` restores the target release's env snapshot
(`.deploy-releases/<sha>.env`) before reloading. If no snapshot exists for that
release it keeps the current env and prints a warning; the failed deploy's own
env is already restored by the pre-deploy trap, so the old release boots with
the old mode.

If the ownership transfer itself was wrong, restore the pre-change backup and
re-run provisioning. `mms_app` can remain the owner while the mode is `warn`.

## 6. What this does not do

RLS is the second layer. Application predicates (`workspace_subdomain = …`) and
the tenant-transaction guard remain mandatory; this runbook only ensures the
database backstop is not silently inert.
