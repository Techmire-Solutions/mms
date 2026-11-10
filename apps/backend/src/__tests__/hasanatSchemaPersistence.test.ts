import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Guard rails for the Hasanat schema/persistence hardening (migrations 0225–0229).
 *
 * These are source-level assertions: the invariants they protect (trigger-owned stock projection,
 * column-list SET NULL, per-card uniqueness, session attribution, restore provenance) cannot be
 * exercised without a live PostgreSQL, and the failure they prevent is a silent regression in a
 * later migration/edit rather than a runtime branch in this process.
 */
describe("Hasanat schema & persistence invariants (0225–0229)", () => {
  const dir = join(process.cwd(), "src/db/migrations_drizzle");
  const read = (name: string) => readFile(join(dir, name), "utf-8");

  const migrations = [
    "0225_hasanat_stock_integrity.sql",
    "0226_hasanat_ledger_and_person_fks.sql",
    "0227_hasanat_session_attribution.sql",
    "0228_hasanat_query_indexes.sql",
    "0229_hasanat_rls_and_timestamps.sql",
  ] as const;

  it("tracks every hardening migration in the drizzle journal", async () => {
    const journal = JSON.parse(await readFile(join(dir, "meta/_journal.json"), "utf-8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    for (const [offset, file] of migrations.entries()) {
      const tag = file.replace(/\.sql$/, "");
      const entry = journal.entries.find((e) => e.tag === tag);
      expect(entry, `${tag} missing from journal`).toBeDefined();
      expect(entry?.idx).toBe(225 + offset);
    }
  });

  it("keeps batch stock as a DB-maintained projection of live distributions", async () => {
    const sql = await read(migrations[0]);

    // Locking recompute function + both triggers.
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION hasanat_recalc_batch_remaining/i);
    expect(sql).toMatch(/FOR UPDATE/i);
    expect(sql).toMatch(/deleted_at IS NULL[\s\S]{0,80}status <> 'returned'/i);
    expect(sql).toMatch(/trg_hasanat_distributions_recalc_remaining/i);
    expect(sql).toMatch(/trg_hasanat_batches_sync_remaining/i);

    // The invariant that turns an over-issue into a failed statement.
    expect(sql).toMatch(
      /CONSTRAINT "hasanat_batches_remaining_chk"[\s\S]*?CHECK \(remaining >= 0 AND remaining <= quantity\)/i,
    );
    // Legacy rows are never rewritten blindly: NOT VALID + best-effort validation.
    expect(sql).toMatch(/NOT VALID/i);
    expect(sql).toMatch(/VALIDATE CONSTRAINT/i);
  });

  it("nulls only the person column when a recipient is deleted", async () => {
    const sql = await read(migrations[1]);

    expect(sql).toMatch(/ON DELETE SET NULL \("recipient_student_id"\)/i);
    expect(sql).toMatch(/ON DELETE SET NULL \("recipient_faculty_id"\)/i);
    // The unqualified form nulls workspace_subdomain (NOT NULL) and aborts the delete.
    expect(sql).not.toMatch(/ON DELETE SET NULL\s*;/i);
  });

  it("makes the redemption ledger append-only and single-burn per card", async () => {
    const sql = await read(migrations[1]);

    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "student_id"/i);
    expect(sql).toMatch(/hasanat_redemption_guard/i);
    expect(sql).toMatch(/hasanat_redemp_ws_dist_uidx/i);
    expect(sql).toMatch(
      /trg_hasanat_redemptions_forbid_hard_delete[\s\S]*?BEFORE DELETE ON "hasanat_redemptions"/i,
    );
  });

  it("attributes points to the card's own academic session", async () => {
    const sql = await read(migrations[2]);

    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "session_id"/i);
    expect(sql).toMatch(/hasanat_distributions_session_fk/i);
    expect(sql).toMatch(/hasanat_stamp_session_from_class/i);
    expect(sql).toMatch(/UPDATE "hasanat_distributions" d[\s\S]*?sc\."session_id"/i);
  });

  it("indexes the balance, history and ledger read paths", async () => {
    const sql = await read(migrations[3]);

    // (tenant, student, session, status) — balance aggregation.
    expect(sql).toMatch(
      /"hasanat_dist_ws_student_session_status_idx"[\s\S]*?\("workspace_subdomain", "recipient_student_id", "session_id", "status"\)/i,
    );
    // (tenant, card_id, created_at) — ledger history.
    expect(sql).toMatch(
      /"hasanat_redemp_ws_dist_created_idx"[\s\S]*?\("workspace_subdomain", "distribution_id", "created_at" DESC\)/i,
    );
    // Default Work list sort.
    expect(sql).toMatch(
      /"hasanat_dist_ws_updated_active_idx"[\s\S]*?\("workspace_subdomain", "updated_at" DESC\)[\s\S]*?WHERE "deleted_at" IS NULL/i,
    );
    // Superseded single-purpose indexes are removed, not accumulated.
    for (const dropped of [
      "hasanat_dist_workspace_student_idx",
      "hasanat_dist_workspace_status_idx",
      "hasanat_dist_workspace_active_idx",
      "hasanat_redemp_workspace_dist_idx",
    ]) {
      expect(sql).toMatch(new RegExp(`DROP INDEX IF EXISTS "${dropped}"`, "i"));
    }
  });

  it("restores the soft-delete RLS gate and aligns timestamps", async () => {
    const sql = await read(migrations[4]);

    expect(sql).toMatch(/DROP POLICY IF EXISTS "hasanat_distributions_tenant_isolation"/i);
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "hasanat_distributions"/i,
    );
    expect(sql).toMatch(/CREATE POLICY "tenant_soft_delete_isolation" ON "hasanat_distributions"/i);
    expect(sql).toMatch(/ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''/i);
    expect(sql).toMatch(/update_hasanat_distributions_updated_at/i);
  });

  it("never persists a client-supplied batch remainder", async () => {
    const repo = await readFile(
      join(process.cwd(), "src/db/repositories/hasanatBatchesRepository.ts"),
      "utf-8",
    );

    expect(repo).not.toMatch(/remaining:\s*record\.remaining/);
    expect(repo).not.toMatch(/remaining:\s*r\.remaining/);
    expect(repo).not.toMatch(/excluded\.remaining/);
  });

  it("persists restore provenance on both the single and bulk restore paths", async () => {
    const persist = await readFile(
      join(process.cwd(), "src/db/repositories/hasanatDistributionsPersist.ts"),
      "utf-8",
    );

    expect(persist).toMatch(
      /restoredAt:\s*record\.restoredAt \? new Date\(record\.restoredAt\) : null/,
    );
    expect(persist).toMatch(/restoredBy:\s*record\.restoredBy \?\? null/);
    expect(persist).toMatch(/restoredAt: now,/);
    expect(persist).toMatch(/restoredBy: userId \|\| null,/);
  });

  it("attributes the session report by session_id instead of lifetime points", async () => {
    const report = await readFile(
      join(process.cwd(), "src/db/repositories/hasanatRepositoryReport.ts"),
      "utf-8",
    );

    expect(report).toMatch(/hd\.session_id = sel\."sessionId"/);
    expect(report).not.toMatch(/ss\."studentId"/);
    // One points definition: no id/name guessing fallback.
    expect(report).not.toMatch(/WHEN .*denomination_id.*= 'den1'/i);
  });
});
