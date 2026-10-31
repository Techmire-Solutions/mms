/**
 * One-time operator step: make a dedicated non-bypass role the owner of an
 * existing MMS database, so strict RLS can be enabled without breaking
 * migrations.
 *
 * Fresh installs (docker-compose) already create `mms_app` before any table
 * exists. This script exists for databases that were created by `postgres`, where
 * the tables/functions/types are owned by `postgres` and the app role could not
 * run DDL or pass the strict boot guard.
 *
 * Usage (from apps/backend, with Node 24):
 *   ADMIN_DATABASE_URL=postgres://postgres@localhost:5432/mms \
 *   MMS_DB_PASSWORD='<new-role-password>' \
 *   node --experimental-strip-types src/scripts/provisionRlsRole.ts [--dry-run]
 *
 * It is idempotent: re-running only re-applies the role flags and ownership.
 * `ALTER DATABASE` cannot run inside a transaction, so it is executed first and
 * the object-ownership changes follow in one transaction.
 */
import process from "node:process";
import pg from "pg";

const adminUrl = process.env.ADMIN_DATABASE_URL?.trim();
const password = process.env.MMS_DB_PASSWORD;
const role = process.env.MMS_DB_ROLE?.trim() || "mms_app";
const dryRun = process.argv.includes("--dry-run");

function fail(message: string): never {
  console.error(`[provision-rls] ${message}`);
  process.exit(1);
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

if (!adminUrl) fail("ADMIN_DATABASE_URL is required (a superuser connection).");
if (!password) fail("MMS_DB_PASSWORD is required (the new role's password).");
const dbPassword: string = password;
if (!/^[a-z_][a-z0-9_]*$/.test(role)) fail(`invalid MMS_DB_ROLE: ${role}`);

const parsed = new URL(adminUrl);
const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
if (!database) fail("ADMIN_DATABASE_URL must include a database name.");

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role]);

    // `public` holds the domain tables; `drizzle` holds the migration ledger.
    // Extension-owned objects are excluded: transferring them would break
    // `ALTER/DROP EXTENSION`, which remains an admin operation.
    const schemaRows = await client.query<{ name: string }>(
      `SELECT nspname AS name FROM pg_namespace
        WHERE nspname = ANY($1::text[]) ORDER BY nspname`,
      [["public", "drizzle"]],
    );
    const schemas = schemaRows.rows.map((row) => row.name);

    const relations = await client.query<{ schema: string; name: string; kind: string }>(
      `SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ANY($1::text[])
          AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
        ORDER BY 1, 2`,
      [schemas],
    );
    const functions = await client.query<{ signature: string }>(
      `SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS signature
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = ANY($1::text[]) AND p.prokind IN ('f', 'p')
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')`,
      [schemas],
    );
    const types = await client.query<{ schema: string; name: string }>(
      `SELECT n.nspname AS schema, t.typname AS name
         FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = ANY($1::text[]) AND t.typtype IN ('e', 'd')
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = t.oid AND d.deptype = 'e')`,
      [schemas],
    );

    const countKind = (...kinds: string[]) =>
      relations.rows.filter((row) => kinds.includes(row.kind)).length;
    const objectCounts = {
      tables: countKind("r", "p"),
      sequences: countKind("S"),
      views: countKind("v", "m"),
      functions: functions.rows.length,
      types: types.rows.length,
    };

    console.log(
      `[provision-rls] ${dryRun ? "DRY RUN — " : ""}role=${role} database=${database} schemas=${schemas.join(",")}`,
    );
    console.log(`[provision-rls] app objects: ${JSON.stringify(objectCounts)}`);

    if (dryRun) {
      console.log(
        `[provision-rls] would ${exists.rowCount ? "update" : "create"} role, create btree_gist/pg_trgm, ` +
          `set ${database} owner, and reassign ${Object.values(objectCounts).reduce((a, b) => a + b, 0)} app objects.`,
      );
      return;
    }

    if (!exists.rowCount) {
      await client.query(
        `CREATE ROLE ${quoteIdent(role)} LOGIN PASSWORD ${quoteLiteral(dbPassword)} ` +
          `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
      );
    } else {
      await client.query(
        `ALTER ROLE ${quoteIdent(role)} LOGIN PASSWORD ${quoteLiteral(dbPassword)} ` +
          `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
      );
    }

    // Trusted extensions; the admin connection owns this step so later
    // migrations run as the app role without superuser rights.
    await client.query("CREATE EXTENSION IF NOT EXISTS btree_gist");
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");

    // Cannot run inside a transaction block.
    await client.query(`ALTER DATABASE ${quoteIdent(database)} OWNER TO ${quoteIdent(role)}`);

    await client.query("BEGIN");
    try {
      for (const { schema, name, kind } of relations.rows) {
        const target = `${quoteIdent(schema)}.${quoteIdent(name)}`;
        if (kind === "r" || kind === "p") {
          await client.query(`ALTER TABLE ${target} OWNER TO ${quoteIdent(role)}`);
        } else if (kind === "S") {
          await client.query(`ALTER SEQUENCE ${target} OWNER TO ${quoteIdent(role)}`);
        } else if (kind === "v") {
          await client.query(`ALTER VIEW ${target} OWNER TO ${quoteIdent(role)}`);
        } else {
          await client.query(`ALTER MATERIALIZED VIEW ${target} OWNER TO ${quoteIdent(role)}`);
        }
      }

      for (const { signature } of functions.rows) {
        // Constructed from `format('%I.%I(%s)')` over catalog identifiers.
        await client.query(`ALTER FUNCTION ${signature} OWNER TO ${quoteIdent(role)}`);
      }

      for (const { schema, name } of types.rows) {
        await client.query(
          `ALTER TYPE ${quoteIdent(schema)}.${quoteIdent(name)} OWNER TO ${quoteIdent(role)}`,
        );
      }

      for (const schema of schemas) {
        await client.query(`ALTER SCHEMA ${quoteIdent(schema)} OWNER TO ${quoteIdent(role)}`);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }

    console.log(
      `[provision-rls] ${role} now owns ${database} and its ${schemas.join("/")} objects.`,
    );
    console.log(
      `[provision-rls] Next: set DATABASE_URL=postgresql://${role}:<password>@<host>:5432/${database} ` +
        `and MMS_DB_ROLE_ENFORCEMENT=strict in apps/backend/.env, then run ` +
        `"pnpm --filter mms-backend run db:check-rls".`,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  console.error("[provision-rls] failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
