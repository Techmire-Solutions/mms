#!/bin/sh
# Creates the non-superuser application role required by the backend's strict RLS
# boot guard (assertRlsRuntimeRole). Runs only on a fresh Postgres data directory.
set -eu

if [ -z "${MMS_DB_PASSWORD:-}" ]; then
  echo "MMS_DB_PASSWORD is required to provision the mms_app role" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mms_app') THEN
    CREATE ROLE mms_app LOGIN PASSWORD '${MMS_DB_PASSWORD}'
      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
\$\$;

-- Make the app role the database owner so boot-time migrations (DDL) work while
-- still being subject to FORCE ROW LEVEL SECURITY.
ALTER DATABASE "${POSTGRES_DB}" OWNER TO mms_app;
GRANT ALL ON SCHEMA public TO mms_app;
SQL

echo "Provisioned mms_app (NOSUPERUSER NOBYPASSRLS) for ${POSTGRES_DB}"
