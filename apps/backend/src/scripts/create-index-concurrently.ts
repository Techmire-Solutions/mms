import pg from "pg";
import { loadBackendEnv } from "../config/loadEnv.js";
import { loadServerConfig } from "../config/serverConfig.js";
import { logger } from "../lib/logger.js";
import { initializeDatabaseConnection, closeDatabase } from "../db/dbConnection.js";

loadBackendEnv();

/**
 * Creates an index with `CONCURRENTLY`, outside a transaction.
 *
 * Why this is a separate script rather than a migration
 * ----------------------------------------------------
 * Drizzle's migrator wraps EVERY statement of a migration run in a single
 * transaction (see `PgDialect.migrate` → `session.transaction(...)`), and
 * PostgreSQL refuses `CREATE INDEX CONCURRENTLY` inside a transaction block. So
 * `CONCURRENTLY` simply cannot be expressed in `src/db/migrations_drizzle/*.sql`.
 *
 * A plain `CREATE INDEX` takes a lock that blocks writes to the table for the
 * duration of the build, which is unacceptable on the large, hot tables
 * (contacts, students, audit_trail_events, message_logs) once they hold real
 * data. This script is the escape hatch: run it as a deploy step for indexes on
 * large tables, and let small/new tables use ordinary in-migration indexes.
 *
 * Usage:
 *   pnpm --filter mms-backend tsx src/scripts/create-index-concurrently.ts \
 *     --table contacts --columns workspace_subdomain,deleted_at \
 *     [--name contacts_ws_deleted_cix] [--unique] [--where "deleted_at IS NULL"]
 *
 * The script only emits DDL for identifiers it validates, so it cannot be used
 * to inject arbitrary SQL by accident.
 */

import fs from "node:fs";
import path from "node:path";

interface ParsedArgs {
  file?: string;
  table?: string;
  columns?: string[];
  include?: string[];
  using?: string;
  name?: string;
  unique: boolean;
  where?: string;
}

/** Conservative identifier check: letters, digits, underscore; not empty. */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ALLOWED_INDEX_METHODS = new Set(["btree", "brin", "gin", "gist", "hash"]);

function parseArgs(argv: string[]): ParsedArgs {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const file = get("--file");
  if (file) {
    return {
      file,
      unique: false,
    };
  }

  const table = get("--table");
  const columnsRaw = get("--columns");

  if (!table || !columnsRaw) {
    console.error(
      "Usage: tsx src/scripts/create-index-concurrently.ts --table <table> " +
        '--columns <col1,col2> [--name <index_name>] [--unique] [--using <method>] [--include <col1,col2>] [--where "<predicate>"]\n' +
        "   OR: tsx src/scripts/create-index-concurrently.ts --file <path/to/script.sql>",
    );
    process.exit(1);
  }

  if (!IDENTIFIER.test(table)) {
    console.error(`Invalid table name: ${table}`);
    process.exit(1);
  }

  const columns = columnsRaw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (columns.length === 0 || columns.some((c) => !IDENTIFIER.test(c))) {
    console.error(`Invalid column list: ${columnsRaw}`);
    process.exit(1);
  }

  const includeRaw = get("--include");
  let include: string[] | undefined;
  if (includeRaw) {
    include = includeRaw
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (include.length === 0 || include.some((c) => !IDENTIFIER.test(c))) {
      console.error(`Invalid include column list: ${includeRaw}`);
      process.exit(1);
    }
  }

  const using = get("--using")?.toLowerCase();
  if (using && !ALLOWED_INDEX_METHODS.has(using)) {
    console.error(
      `Invalid index method: ${using}. Allowed: ${Array.from(ALLOWED_INDEX_METHODS).join(", ")}`,
    );
    process.exit(1);
  }

  const name = get("--name");
  if (name !== undefined && !IDENTIFIER.test(name)) {
    console.error(`Invalid index name: ${name}`);
    process.exit(1);
  }

  // `--where` is a raw predicate by necessity (partial-index predicates are not
  // parameterizable). It is quoted-and-rejected rather than sanitized: the
  // operator running this is a deployer, but we still refuse obvious injection.
  const where = get("--where");
  if (where !== undefined && /;|--|\/\*/.test(where)) {
    console.error("Refusing --where containing statement terminators or comments.");
    process.exit(1);
  }

  return {
    table,
    columns,
    include,
    using,
    name: name ?? `${table}_${columns.join("_")}_cix`,
    unique: argv.includes("--unique"),
    where,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // A dedicated client, NOT the shared pool: CONCURRENTLY must run in
  // autocommit mode, and a pooled connection could be left mid-transaction.
  initializeDatabaseConnection();
  const { databaseUrl } = loadServerConfig();
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    if (args.file) {
      const resolvedPath = path.resolve(args.file);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`File not found: ${resolvedPath}`);
      }
      const rawSql = fs.readFileSync(resolvedPath, "utf8");
      const strippedSql = rawSql
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => {
          const commentIdx = line.indexOf("--");
          return commentIdx >= 0 ? line.slice(0, commentIdx) : line;
        })
        .join("\n");

      const statements = strippedSql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      console.log(
        `[create-index-concurrently] Executing ${statements.length} statements from ${args.file}...`,
      );
      for (const statement of statements) {
        console.log(`[create-index-concurrently] > ${statement.slice(0, 120)}...`);
        await client.query(statement);
      }
      console.log(`✅ All statements from ${args.file} executed successfully.`);
      return;
    }

    const usingClause = args.using ? `USING ${args.using} ` : "";
    const includeClause = args.include
      ? ` INCLUDE (${args.include.map((c) => `"${c}"`).join(", ")})`
      : "";
    const concurrent =
      `CREATE ${args.unique ? "UNIQUE " : ""}INDEX CONCURRENTLY IF NOT EXISTS ` +
      `"${args.name}" ON "${args.table}" ${usingClause}(${args.columns!.map((c) => `"${c}"`).join(", ")})` +
      includeClause +
      (args.where ? ` WHERE ${args.where}` : "") +
      ";";

    console.log(`[create-index-concurrently] ${concurrent}`);
    console.log(
      "[create-index-concurrently] Note: CONCURRENTLY cannot run inside a transaction; " +
        "this runs in autocommit mode and is safe on a live table (slower than a plain build).",
    );

    // `CREATE INDEX CONCURRENTLY` can leave an INVALID index behind if it fails;
    // it is then not used by the planner and must be dropped before retrying.
    await client.query(concurrent);

    const { rows } = await client.query<{ indisvalid: boolean }>(
      `SELECT indisvalid FROM pg_index WHERE indexrelid = to_regclass($1)`,
      [args.name],
    );
    if (rows[0] && rows[0].indisvalid === false) {
      throw new Error(
        `Index "${args.name}" was created but is INVALID (the build was interrupted). ` +
          `Drop it with: DROP INDEX CONCURRENTLY "${args.name}"; then retry.`,
      );
    }

    console.log(`✅ Index "${args.name}" created (valid).`);
  } finally {
    await client.end().catch(() => undefined);
    await closeDatabase().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "create-index-concurrently failed");
  console.error("✗ Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
