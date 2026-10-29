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
import pg from "pg";
import {
  decideRlsRole,
  resolveRlsEnforcementMode,
  type RuntimeRoleCheck,
} from "../db/rlsRoleGuard.js";

interface RoleRow {
  role: string;
  is_superuser: boolean;
  bypass_rls: boolean;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error("[rls] DATABASE_URL is required to check the runtime role.");
    process.exitCode = 1;
    return;
  }

  const mode = resolveRlsEnforcementMode();
  const json = process.argv.includes("--json");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<RoleRow>(
      `SELECT current_user AS role, r.rolsuper AS is_superuser, r.rolbypassrls AS bypass_rls
         FROM pg_roles r WHERE r.rolname = current_user`,
    );
    const row = result.rows[0];
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
      process.exitCode = 1;
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  console.error("[rls] role check failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
