/**
 * Creates an index with `CONCURRENTLY`, outside a transaction.
 *
 * Why this is a separate script rather than a migration
 * ----------------------------------------------------
 * Drizzle's migrator wraps EVERY statement of a migration run in a single transaction (see
 * `PgDialect.migrate` → `session.transaction(...)`), and PostgreSQL refuses
 * `CREATE INDEX CONCURRENTLY` inside a transaction block. So `CONCURRENTLY` cannot be
 * expressed in `packages/db/migrations_drizzle/*.sql`.
 *
 * A plain `CREATE INDEX` takes a lock that blocks writes for the duration of the build,
 * which is unacceptable on the large, hot tables (contacts, students, audit_trail_events,
 * message_logs) once they hold real data. This script is the escape hatch: run it as a
 * deploy step for indexes on large tables and let small/new tables use in-migration indexes.
 *
 * Connection settings come from the process environment (`DATABASE_URL`); `packages/db`
 * never parses `.env`. The app entry (`apps/api/src/scripts/createIndexConcurrently.ts`)
 * loads the env files and then calls `main()`.
 *
 * Usage:
 *   pnpm --filter @mms/db run index:concurrent -- \
 *     --table contacts --columns workspace_subdomain,deleted_at \
 *     [--name contacts_ws_deleted_cix] [--unique] [--where "deleted_at IS NULL"]
 *   pnpm --filter @mms/db run index:concurrent -- --file packages/db/scripts/sql/<name>.sql
 *
 * The script only emits DDL for identifiers it validates, so it cannot be used to inject
 * arbitrary SQL by accident.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export interface ParsedArgs {
  file?: string;
  table?: string;
  columns?: string[];
  include?: string[];
  using?: string;
  name?: string;
  unique: boolean;
  where?: string;
}

/** `--help` short-circuits before any connection is opened. */
export type ParsedInvocation = { kind: "help" } | { kind: "run"; args: ParsedArgs };

/** Conservative identifier check: letters, digits, underscore; not empty. */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ALLOWED_INDEX_METHODS = new Set(["btree", "brin", "gin", "gist", "hash"]);

export const USAGE = [
  "Usage: pnpm --filter @mms/db run index:concurrent -- --table <table> " +
    '--columns <col1,col2> [--name <index_name>] [--unique] [--using <method>] [--include <col1,col2>] [--where "<predicate>"]',
  "   OR: pnpm --filter @mms/db run index:concurrent -- --file <path/to/script.sql>",
].join("\n");

export function parseArgs(argv: string[]): ParsedInvocation {
  if (argv.includes("--help") || argv.includes("-h")) {
    return { kind: "help" };
  }

  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const file = get("--file");
  if (file) {
    return { kind: "run", args: { file, unique: false } };
  }

  const table = get("--table");
  const columnsRaw = get("--columns");

  if (!table || !columnsRaw) {
    throw new Error(USAGE);
  }

  if (!IDENTIFIER.test(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }

  const columns = columnsRaw
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
  if (columns.length === 0 || columns.some((column) => !IDENTIFIER.test(column))) {
    throw new Error(`Invalid column list: ${columnsRaw}`);
  }

  const includeRaw = get("--include");
  let include: string[] | undefined;
  if (includeRaw) {
    include = includeRaw
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean);
    if (include.length === 0 || include.some((column) => !IDENTIFIER.test(column))) {
      throw new Error(`Invalid include column list: ${includeRaw}`);
    }
  }

  const using = get("--using")?.toLowerCase();
  if (using && !ALLOWED_INDEX_METHODS.has(using)) {
    throw new Error(
      `Invalid index method: ${using}. Allowed: ${Array.from(ALLOWED_INDEX_METHODS).join(", ")}`,
    );
  }

  const name = get("--name");
  if (name !== undefined && !IDENTIFIER.test(name)) {
    throw new Error(`Invalid index name: ${name}`);
  }

  // `--where` is a raw predicate by necessity (partial-index predicates are not
  // parameterizable). It is quoted-and-rejected rather than sanitized: the operator
  // running this is a deployer, but we still refuse obvious injection.
  const where = get("--where");
  if (where !== undefined && /;|--|\/\*/.test(where)) {
    throw new Error("Refusing --where containing statement terminators or comments.");
  }

  return {
    kind: "run",
    args: {
      table,
      columns,
      include,
      using,
      name: name ?? `${table}_${columns.join("_")}_cix`,
      unique: argv.includes("--unique"),
      where,
    },
  };
}

/** Fails closed: a missing URL must never silently target a local database. */
function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to build an index concurrently.");
  }
  return databaseUrl;
}

export async function main(): Promise<void> {
  let invocation: ParsedInvocation;
  try {
    invocation = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  if (invocation.kind === "help") {
    console.log(USAGE);
    return;
  }

  const args = invocation.args;

  // A dedicated client, NOT a pool: CONCURRENTLY must run in autocommit mode, and a pooled
  // connection could be left mid-transaction.
  let client: pg.Client | undefined;

  try {
    client = new pg.Client({ connectionString: requireDatabaseUrl() });
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
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0);

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
      ? ` INCLUDE (${args.include.map((column) => `"${column}"`).join(", ")})`
      : "";
    const concurrent =
      `CREATE ${args.unique ? "UNIQUE " : ""}INDEX CONCURRENTLY IF NOT EXISTS ` +
      `"${args.name}" ON "${args.table}" ${usingClause}(${args.columns!.map((column) => `"${column}"`).join(", ")})` +
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
  } catch (error) {
    console.error("✗ Failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await client?.end().catch(() => undefined);
  }
}

const isEntrypoint =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("createIndexConcurrently.ts") ||
    process.argv[1].endsWith("createIndexConcurrently.js") ||
    fileURLToPath(import.meta.url) === process.argv[1]);

if (isEntrypoint) {
  void main();
}
