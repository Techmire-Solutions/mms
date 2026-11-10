import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Guard rails for the Hasanat schema/persistence hardening (migrations 0225–0232).
 *
 * These are source-level assertions: the invariants they protect (trigger-owned stock projection,
 * column-list SET NULL, per-card uniqueness, session attribution, restore provenance) cannot be
 * exercised without a live PostgreSQL, and the failure they prevent is a silent regression in a
 * later migration/edit rather than a runtime branch in this process.
 */
describe("Hasanat schema & persistence invariants (0225–0232)", () => {
  const dir = join(process.cwd(), "src/db/migrations_drizzle");
  const read = (name: string) => readFile(join(dir, name), "utf-8");

  const migrations = [
    "0225_hasanat_stock_integrity.sql",
    "0226_hasanat_ledger_and_person_fks.sql",
    "0227_hasanat_session_attribution.sql",
    "0228_hasanat_query_indexes.sql",
    "0229_hasanat_rls_and_timestamps.sql",
    "0230_hasanat_card_value_and_idempotency.sql",
    "0231_hasanat_denom_bounds.sql",
    "0232_hasanat_ledger_immutability.sql",
    "0233_hasanat_tier_awards.sql",
    "0234_hasanat_ledger_list_index.sql",
    "0235_audit_trail_immutability.sql",
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

  it("stamps an immutable card value and an idempotency key", async () => {
    const sql = await read(migrations[5]);

    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "points_snapshot" integer NOT NULL DEFAULT 0/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0/i);
    expect(sql).toMatch(/hasanat_dist_ws_client_request_uidx/i);
    // The guard rejects any rewrite of the stamped value or the idempotency key.
    expect(sql).toMatch(/points_snapshot is immutable/i);
    expect(sql).toMatch(/client_request_id is immutable/i);
    expect(sql).toMatch(/NEW\.version := OLD\.version \+ 1/i);
  });

  it("bounds denomination points at the database", async () => {
    const sql = await read(migrations[6]);
    expect(sql).toMatch(/hasanat_denoms_points_max_chk[\s\S]*?points <= 100000/i);
  });

  it("makes the ledger append-only and reversal-driven", async () => {
    const sql = await read(migrations[7]);

    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "kind" varchar\(16\) NOT NULL DEFAULT 'redeem'/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "reversal_of_id" text/i);
    expect(sql).toMatch(/DROP INDEX IF EXISTS "hasanat_redemp_ws_dist_uidx"/i);
    expect(sql).toMatch(/hasanat_redemp_ws_reversal_uidx/i);
    expect(sql).toMatch(/forbid_ledger_update/i);
    expect(sql).toMatch(/BEFORE UPDATE ON "hasanat_redemptions"/i);
    // The guard ignores reversed rows, so a reversal can reopen the card.
    expect(sql).toMatch(/rev\.reversal_of_id = r\.id/i);
  });

  it("keeps card rules out of the repository adapters", async () => {
    for (const file of ["hasanatCardOps.ts", "hasanatLedgerOps.ts"]) {
      const source = await readFile(join(process.cwd(), "src/db/repositories", file), "utf-8");
      expect(source, `${file} must not raise domain errors`).not.toMatch(
        /from "[^"]*httpErrors\.js"/,
      );
      expect(source).not.toMatch(/throw new (ConflictError|NotFoundError)/);
    }
    // The old adapter that held the redemption policy is gone.
    await expect(
      readFile(join(process.cwd(), "src/db/repositories/hasanatRedeemCard.ts"), "utf-8"),
    ).rejects.toThrow();
  });

  it("routes card writes through the domain use cases", async () => {
    const facade = await readFile(
      join(process.cwd(), "src/hasanat/use-cases/hasanatUseCases.ts"),
      "utf-8",
    );

    expect(facade).toMatch(/issueHasanatCard/);
    expect(facade).toMatch(/redeemHasanatCard/);
    expect(facade).toMatch(/voidHasanatRedemption/);
    expect(facade).toMatch(/changeHasanatCardStatus/);
    // No bulk card write survives the facade.
    expect(facade).not.toMatch(/upsertDistributions|upsertRedemptions|replaceRedemptions/);
  });

  it("does not allow a client to set the card status on create or edit", async () => {
    const manifest = await readFile(
      join(process.cwd(), "../../packages/shared/src/hasanat/hasanatModuleManifest.ts"),
      "utf-8",
    );

    const createSchema = manifest.slice(
      manifest.indexOf("export const distributionCreateSchema"),
      manifest.indexOf("export const distributionUpdateSchema"),
    );
    const updateSchema = manifest.slice(
      manifest.indexOf("export const distributionUpdateSchema"),
      manifest.indexOf("export const distributionStatusSchema"),
    );
    expect(createSchema).not.toMatch(/status:/);
    expect(updateSchema).not.toMatch(/status:/);
    // Value-affecting fields are immutable after issue.
    expect(updateSchema).not.toMatch(/quantity:/);
    expect(updateSchema).not.toMatch(/denominationId:/);
  });

  it("materialises tier awards without ever deleting evidence", async () => {
    const sql = await read(migrations[8]);

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "hasanat_student_awards"/i);
    expect(sql).toMatch(/hasanat_award_ws_student_tier_uidx[\s\S]*?WHERE "revoked_at" IS NULL/i);
    expect(sql).toMatch(/revoked_at/i);
    expect(sql).toMatch(/FORCE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/forbid_hard_delete/i);
  });

  it("keeps academic rollover away from Hasanat rows", async () => {
    const rolloverFiles = [
      "src/sessions/use-cases/sessionRolloverPlan.ts",
      "src/sessions/use-cases/sessionRolloverUseCases.ts",
      "src/sessions/use-cases/sessionRolloverJob.ts",
      "src/sessions/repository/sessionRolloverRepository.ts",
      "src/sessions/use-cases/sessionCompletionUseCases.ts",
    ];
    for (const file of rolloverFiles) {
      const source = await readFile(join(process.cwd(), file), "utf-8");
      // Rollover/completion must never move, reset or delete Hasanat points.
      expect(source, `${file} must not touch hasanat`).not.toMatch(/hasanat/i);
    }
  });

  it("serves the report from one read model instead of a paginated collection", async () => {
    const repo = await readFile(
      join(process.cwd(), "src/db/repositories/hasanatReportRepository.ts"),
      "utf-8",
    );
    expect(repo).toMatch(/WITH cards AS/i);
    expect(repo).toMatch(/points_snapshot/);
    expect(repo).toMatch(/kind = 'reversal'/);

    const component = await readFile(
      join(
        process.cwd(),
        "../../apps/frontend/src/tenant/features/reports/components/HasanatReport.tsx",
      ),
      "utf-8",
    );
    expect(component).toMatch(/useHasanatStudentReport/);
    expect(component).not.toMatch(/useHasanatDistributionsCollection/);
    expect(component).toMatch(/filters\.session/);
  });

  it("indexes the paginated ledger history", async () => {
    const sql = await read(migrations[9]);
    expect(sql).toMatch(
      /"hasanat_redemp_ws_created_idx"[\s\S]*?\("workspace_subdomain", "created_at" DESC\)/i,
    );
  });

  it("keeps idempotency keys and cascade internals out of read models", async () => {
    const manifest = await readFile(
      join(process.cwd(), "../../packages/shared/src/hasanat/hasanatModuleManifest.ts"),
      "utf-8",
    );
    const recordSchemas = manifest.slice(
      manifest.indexOf("export const distributionRecordSchema"),
      manifest.indexOf("export const distributionCreateSchema"),
    );
    const redemptionSchema = manifest.slice(
      manifest.indexOf("export const redemptionRecordSchema"),
      manifest.indexOf("export const redemptionRecordInsertSchema"),
    );
    expect(recordSchemas).not.toMatch(/clientRequestId/);
    expect(recordSchemas).not.toMatch(/deletedWithCascade/);
    expect(redemptionSchema).not.toMatch(/clientRequestId/);
  });

  it("implements every route declared in the hasanat contract", async () => {
    const contract = await readFile(
      join(process.cwd(), "../../packages/shared/src/contracts/hasanat.contract.ts"),
      "utf-8",
    );
    const tierBatch = await readFile(
      join(process.cwd(), "../../packages/shared/src/contracts/hasanatTierBatch.contract.ts"),
      "utf-8",
    );
    const router = await readFile(
      join(process.cwd(), "src/routes/tenant/hasanat/hasanatContractRouter.ts"),
      "utf-8",
    );
    const tierBatchHandlers = await readFile(
      join(process.cwd(), "src/routes/tenant/hasanat/hasanatTierBatchHandlers.ts"),
      "utf-8",
    );

    const contractKeys = [...(contract + tierBatch).matchAll(/^ {2}([a-zA-Z]+): \{/gm)].map(
      (match) => match[1],
    );
    expect(contractKeys.length).toBeGreaterThan(15);

    for (const key of contractKeys) {
      const implemented =
        new RegExp(`^  ${key}:`, "m").test(router) ||
        new RegExp(`handle${key.charAt(0).toUpperCase()}${key.slice(1)}\b`).test(router) ||
        new RegExp(`handle${key.charAt(0).toUpperCase()}${key.slice(1)}\b`).test(tierBatchHandlers);
      expect(implemented, `contract route ${key} has no handler`).toBe(true);
    }
  });

  it("makes the audit trail append-only at the database", async () => {
    const sql = await read(migrations[10]);
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON "audit_trail_events"/i);
    expect(sql).toMatch(/ERRCODE = 'check_violation'/i);
    expect(sql).toMatch(/app\.allow_audit_purge/);
  });

  it("audits every point-mutating use case", async () => {
    const files = [
      "src/hasanat/use-cases/hasanatIssuanceUseCases.ts",
      "src/hasanat/use-cases/hasanatBatchAwardUseCases.ts",
      "src/hasanat/use-cases/hasanatRedemptionUseCases.ts",
      "src/hasanat/use-cases/hasanatCardUseCases.ts",
      "src/hasanat/use-cases/hasanatTierUseCases.ts",
      "src/hasanat/use-cases/hasanatImportJob.ts",
    ];
    for (const file of files) {
      const content = await readFile(join(process.cwd(), file), "utf-8");
      expect(content, `${file} emits no audit event`).toMatch(
        /audit(Card|Ledger|Award|Setup)Mutation|auditCardState/,
      );
    }

    const facade = await readFile(
      join(process.cwd(), "src/hasanat/use-cases/hasanatCardWriteFacade.ts"),
      "utf-8",
    );
    expect(facade).toMatch(/archiveCardEvidence|restoreCardEvidence/);

    const setup = await readFile(
      join(process.cwd(), "src/hasanat/use-cases/hasanatCatalogUseCases.ts"),
      "utf-8",
    );
    expect(setup).toMatch(/auditSetupMutation/);

    const archive = await readFile(
      join(process.cwd(), "src/hasanat/use-cases/hasanatCardArchive.ts"),
      "utf-8",
    );
    expect(archive).toMatch(/auditCardMutation/);
    expect(archive).toMatch(/entity\.soft_deleted/);
    expect(archive).toMatch(/entity\.restored/);
  });

  it("registers the hasanat runners in the shared registry, not a route plugin", async () => {
    const registry = await readFile(
      join(process.cwd(), "src/services/backgroundJobRunnerService.ts"),
      "utf-8",
    );
    expect(registry).toMatch(/registerHasanatJobRunners\(\)/);

    for (const file of [
      "src/hasanat/use-cases/hasanatBatchAwardJob.ts",
      "src/hasanat/use-cases/hasanatImportJob.ts",
    ]) {
      const route = await readFile(join(process.cwd(), "src/routes/tenant/hasanat.ts"), "utf-8");
      expect(route, `${file} must not be registered from the route plugin`).not.toMatch(
        new RegExp(file.split("/").pop()?.replace(".ts", "") ?? "___"),
      );
    }
  });

  it("makes queue writes retry-safe", async () => {
    const batchRepo = await readFile(
      join(process.cwd(), "src/db/repositories/hasanatBatchRepository.ts"),
      "utf-8",
    );
    expect(batchRepo).toMatch(/onConflictDoNothing/);

    const tierRepo = await readFile(
      join(process.cwd(), "src/db/repositories/hasanatTierRepository.ts"),
      "utf-8",
    );
    expect(tierRepo).toMatch(/onConflictDoNothing/);

    const importJob = await readFile(
      join(process.cwd(), "src/hasanat/use-cases/hasanatImportJob.ts"),
      "utf-8",
    );
    expect(importJob).toMatch(/findDistributionsByClientRequestIds/);
    expect(importJob).toMatch(/throwIfBackgroundJobAborted/);
  });
});
