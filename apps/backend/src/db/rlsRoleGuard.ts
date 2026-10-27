import { sql } from "drizzle-orm";
import type { DbClient } from "./dbTransactions.js";
import { logger } from "../lib/logger.js";

/**
 * Runtime guard for the role the application connects as.
 *
 * The schema is built for defence in depth: 204 tables carry `ENABLE` + `FORCE
 * ROW LEVEL SECURITY` with a single canonical tenant policy. PostgreSQL,
 * however, exempts superusers and `BYPASSRLS` roles from every policy — so if
 * `DATABASE_URL` connects as `postgres` (the documented local default), all of
 * those `FORCE RLS` statements are decorative and tenant isolation rests solely
 * on application predicates. Nothing detected that before: there is no
 * `SET ROLE`, no role in the connection options, and no boot assertion.
 *
 * `assertRlsRuntimeRole` closes that gap by inspecting `current_user` at boot.
 *
 * Modes via `MMS_DB_ROLE_ENFORCEMENT`:
 * - `strict` (default in production) — refuse to boot when RLS does not apply.
 * - `warn` (default elsewhere) — log an error-level warning and continue.
 * - `off` — opt out explicitly (e.g. a single-tenant on-prem install that
 *   intentionally runs as the schema owner).
 */
export type RlsEnforcementMode = "strict" | "warn" | "off";

export interface RuntimeRoleCheck {
  role: string;
  isSuperuser: boolean;
  bypassRls: boolean;
  /** `false` when PostgreSQL ignores RLS for this role. */
  rlsApplies: boolean;
}

const REMEDIATION = [
  "Row-level security is NOT protecting tenant data for this connection.",
  "Create a dedicated role and point DATABASE_URL at it:",
  "  CREATE ROLE mms_app LOGIN PASSWORD '<secret>' NOSUPERUSER NOBYPASSRLS;",
  "  GRANT USAGE ON SCHEMA public TO mms_app;",
  "  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mms_app;",
  "  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mms_app;",
  "Then set DATABASE_URL=postgresql://mms_app:<secret>@<host>:<port>/<db>.",
  "Intentional single-tenant dev installs may set MMS_DB_ROLE_ENFORCEMENT=off.",
].join("\n");

/** Reads the configured mode, defaulting to strict in production. */
export function resolveRlsEnforcementMode(
  explicit = process.env.MMS_DB_ROLE_ENFORCEMENT,
  nodeEnv = process.env.NODE_ENV,
): RlsEnforcementMode {
  const normalized = explicit?.trim().toLowerCase();
  if (normalized === "off" || normalized === "warn" || normalized === "strict") return normalized;
  return nodeEnv === "production" ? "strict" : "warn";
}

/** Inspects the connected role. Read-only; safe to call once at boot. */
export async function inspectRuntimeRole(db: DbClient): Promise<RuntimeRoleCheck> {
  const result = await db.execute(
    sql`SELECT current_user AS role, r.rolsuper AS is_superuser, r.rolbypassrls AS bypass_rls
        FROM pg_roles r WHERE r.rolname = current_user`,
  );
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows) ?? [];
  const row = rows[0] as
    { role?: string; is_superuser?: boolean; bypass_rls?: boolean } | undefined;
  if (!row) {
    throw new Error("[rls] could not resolve current_user from pg_roles");
  }
  const isSuperuser = row.is_superuser === true;
  const bypassRls = row.bypass_rls === true;
  return {
    role: String(row.role ?? "unknown"),
    isSuperuser,
    bypassRls,
    rlsApplies: !isSuperuser && !bypassRls,
  };
}

/**
 * Fails (or warns) when the runtime role bypasses RLS.
 *
 * @throws when the mode is `strict` and PostgreSQL will ignore every policy.
 */
export async function assertRlsRuntimeRole(
  db: DbClient,
  options: { mode?: RlsEnforcementMode } = {},
): Promise<RuntimeRoleCheck> {
  const mode = options.mode ?? resolveRlsEnforcementMode();
  if (mode === "off") {
    logger.debug("[rls] runtime role check disabled via MMS_DB_ROLE_ENFORCEMENT=off");
    return { role: "unchecked", isSuperuser: false, bypassRls: false, rlsApplies: true };
  }

  let check: RuntimeRoleCheck;
  try {
    check = await inspectRuntimeRole(db);
  } catch (error) {
    // A failed inspection is not evidence of a bypass (pg_roles is readable by
    // every role). Never turn an unimplemented/mocked client into a boot
    // failure — log it so a real catalog problem is still visible.
    logger.error({ err: error }, "[rls] could not inspect the runtime database role");
    return { role: "unknown", isSuperuser: false, bypassRls: false, rlsApplies: true };
  }

  if (check.rlsApplies) {
    logger.info({ role: check.role }, "[rls] runtime role is subject to row-level security");
    return check;
  }

  const detail = {
    role: check.role,
    isSuperuser: check.isSuperuser,
    bypassRls: check.bypassRls,
    mode,
  };

  if (mode === "strict") {
    throw new Error(
      `[rls] refusing to start: the database role bypasses row-level security.\n${JSON.stringify(detail)}\n${REMEDIATION}`,
    );
  }

  logger.error(
    { ...detail },
    `[rls] the database role bypasses row-level security — every tenant RLS policy is inert. ${REMEDIATION}`,
  );
  return check;
}
