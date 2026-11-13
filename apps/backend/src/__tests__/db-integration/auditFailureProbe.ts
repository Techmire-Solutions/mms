import { sql } from "drizzle-orm";
import { expect } from "vitest";
import { withTenant } from "../../db/tenant-context.js";

/**
 * Forces every audit append for one workspace to fail inside the caller's
 * transaction, so "the audit row rolls the mutation back" can be asserted for any
 * money mutation. Shared by the audit-atomicity suite and the FX/hedge/IAS 29
 * suites that own those fixtures.
 */
export async function installAuditFailure(tenant: string): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION probe_fail_audit_append() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'probe: audit append forced to fail';
      END;
      $$ LANGUAGE plpgsql
    `);
    // DDL cannot take bind parameters: inline the (test-constant) tenant literal.
    await tx.execute(
      sql.raw(`
      CREATE TRIGGER probe_fail_audit
      BEFORE INSERT ON audit_trail_events
      FOR EACH ROW WHEN (NEW.workspace_subdomain = '${tenant}')
      EXECUTE FUNCTION probe_fail_audit_append()
    `),
    );
  });
}

export async function removeAuditFailure(tenant: string): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx.execute(sql`DROP TRIGGER IF EXISTS probe_fail_audit ON audit_trail_events`);
  });
}

/** Drizzle wraps driver errors; a probe rejection is matched across the chain. */
export async function expectRejectedWith(
  promise: Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const err = error as {
      message?: string;
      cause?: { message?: string; detail?: string };
      detail?: string;
    };
    const text = [
      err.message ?? "",
      err.cause?.message ?? "",
      err.cause?.detail ?? "",
      err.detail ?? "",
    ].join(" ");
    expect(text).toMatch(pattern);
    return;
  }
  throw new Error("expected the mutation to be rejected");
}

/** Runs `mutation` with the audit probe installed and restores the probe afterwards. */
export async function withAuditFailure<T>(tenant: string, mutation: () => Promise<T>): Promise<T> {
  await installAuditFailure(tenant);
  try {
    return await mutation();
  } finally {
    await removeAuditFailure(tenant);
  }
}
