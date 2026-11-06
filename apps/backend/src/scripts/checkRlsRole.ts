/**
 * Deploy preflight: assert that the database role the app will use is subject to
 * row-level security.
 *
 * Runs before migrations / PM2 reload so a bypassing role stops the deploy while
 * the previous release keeps serving. Exit codes:
 *   0 — role is subject to RLS, or the mode is `warn`/`off` (message printed)
 *   1 — mode is `strict` and the role bypasses RLS, or the check itself failed
 *
 * Usage: pnpm --filter mms-backend run db:check-rls [-- --json]
 */
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  decideRlsRole,
  resolveRlsEnforcementMode,
  type RlsEnforcementMode,
  type RuntimeRoleCheck,
} from "../db/rlsRoleGuard.js";

export interface RoleRow {
  role: string;
  is_superuser: boolean;
  bypass_rls: boolean;
}

export interface ConnectRetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  clientFactory?: (connectionString: string) => {
    connect: () => Promise<void>;
    end: () => Promise<void>;
  };
}

export interface RlsRoleCheckClient {
  query: (sql: string) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
}

export interface RunRlsRoleCheckOptions {
  connectionString?: string;
  mode?: RlsEnforcementMode;
  json?: boolean;
  client?: RlsRoleCheckClient;
}

export function isTransientConnectionError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  return (
    code === "57P03" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    message.includes("recovery mode") ||
    message.includes("not yet accepting connections") ||
    message.includes("starting up") ||
    message.includes("Connection terminated")
  );
}

export async function connectClientWithRetry(
  connectionString: string,
  options?: ConnectRetryOptions,
): Promise<pg.Client> {
  const maxAttempts = options?.maxAttempts ?? 15;
  const delayMs = options?.delayMs ?? 2000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = (
      options?.clientFactory
        ? options.clientFactory(connectionString)
        : new pg.Client({ connectionString })
    ) as pg.Client;

    try {
      await client.connect();
      return client;
    } catch (err) {
      lastError = err;
      await client.end().catch(() => undefined);

      if (!isTransientConnectionError(err) || attempt === maxAttempts) {
        throw err;
      }

      const message = err instanceof Error ? err.message : String(err);
      console.log(
        `[rls] database temporarily unavailable (${message}), retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

export async function runRlsRoleCheck(options?: RunRlsRoleCheckOptions): Promise<number> {
  const connectionString = options?.connectionString ?? process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error("[rls] DATABASE_URL is required to check the runtime role.");
    return 1;
  }

  const mode = options?.mode ?? resolveRlsEnforcementMode();
  const json = options?.json ?? process.argv.includes("--json");
  const client: RlsRoleCheckClient =
    options?.client ?? (await connectClientWithRetry(connectionString));

  try {
    const result = await client.query(
      `SELECT current_user AS role, r.rolsuper AS is_superuser, r.rolbypassrls AS bypass_rls
         FROM pg_roles r WHERE r.rolname = current_user`,
    );
    const row = result.rows[0] as RoleRow | undefined;
    if (!row) throw new Error("could not resolve current_user from pg_roles");

    const check: RuntimeRoleCheck = {
      role: String(row.role),
      isSuperuser: row.is_superuser === true,
      bypassRls: row.bypass_rls === true,
      rlsApplies: !(row.is_superuser === true || row.bypass_rls === true),
    };
    const decision = decideRlsRole(check, mode);

    if (json) {
      console.log(JSON.stringify({ ...check, mode, decision }, null, 2));
    } else {
      console.log(
        `[rls] role=${check.role} superuser=${check.isSuperuser} bypassrls=${check.bypassRls} ` +
          `rls_applies=${check.rlsApplies} mode=${mode}`,
      );
    }
    if (decision.level === "warn") console.warn(decision.message);
    if (!decision.allow) {
      console.error(decision.message);
      return 1;
    }
    return 0;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function main(): Promise<void> {
  const code = await runRlsRoleCheck();
  if (code !== 0) {
    process.exitCode = code;
  }
}

const isEntrypoint =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("checkRlsRole.ts") ||
    process.argv[1].endsWith("checkRlsRole.js") ||
    fileURLToPath(import.meta.url) === process.argv[1]);

if (isEntrypoint) {
  main().catch((error: unknown) => {
    console.error(
      "[rls] role check failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
