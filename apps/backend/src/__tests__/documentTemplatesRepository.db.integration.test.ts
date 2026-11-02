import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray, sql } from "drizzle-orm";
import { beginLongLivedTenantTransaction, closeDatabase } from "../db/dbConnection.js";
import { withGlobalTenant, withTenant } from "../db/tenant-context.js";
import { documentTemplates, workspaces } from "../db/schema.js";
import {
  getDocumentTemplateRepo,
  upsertDocumentTemplateRepo,
} from "../db/repositories/documentTemplatesRepository.js";
import { requireDatabaseConnection } from "./db-integration/dbTestSupport.js";

/**
 * Compare-and-set semantics of the document-template repository against a real
 * Postgres row (the route/use-case tests mock the repository, so this suite is what
 * proves the `insert … on conflict do nothing` / `update … where updated_at = ?`
 * statements actually behave as atomic version checks).
 */
const TENANT = "x-cas-templates";
const template = { pageSize: "A6", elements: [] };

async function cleanup(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx
      .delete(documentTemplates)
      .where(inArray(documentTemplates.workspaceSubdomain, [TENANT]));
    await tx.tx.delete(workspaces).where(inArray(workspaces.subdomain, [TENANT]));
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

describe("document template repository CAS", () => {
  beforeAll(async () => {
    await requireDatabaseConnection();
    await cleanup();
    await withGlobalTenant(async (tx) => {
      await tx.insert(workspaces).values({
        id: "ws-cas-templates",
        subdomain: TENANT,
        madrasaName: "CAS Templates",
        enabled: true,
      });
    });
  });

  afterAll(async () => {
    await cleanup();
    await closeDatabase();
  });

  it("inserts when the caller expects no row and rejects a second insert", async () => {
    const inserted = await withTenant(TENANT, () =>
      upsertDocumentTemplateRepo(TENANT, "cas-key", template, null),
    );
    expect(inserted?.template).toEqual(template);

    const second = await withTenant(TENANT, () =>
      upsertDocumentTemplateRepo(TENANT, "cas-key", { ...template, pageSize: "A5" }, null),
    );
    expect(second).toBeNull();

    const stored = await withTenant(TENANT, () => getDocumentTemplateRepo(TENANT, "cas-key"));
    expect(stored?.template.pageSize).toBe("A6");
  });

  it("updates with a matching version and rejects a stale one", async () => {
    const current = await withTenant(TENANT, () => getDocumentTemplateRepo(TENANT, "cas-key"));
    expect(current).not.toBeNull();

    const updated = await withTenant(TENANT, () =>
      upsertDocumentTemplateRepo(
        TENANT,
        "cas-key",
        { ...template, pageSize: "A4" },
        current!.updatedAt,
      ),
    );
    expect(updated?.template.pageSize).toBe("A4");

    const stale = await withTenant(TENANT, () =>
      upsertDocumentTemplateRepo(
        TENANT,
        "cas-key",
        { ...template, pageSize: "80mm" },
        current!.updatedAt,
      ),
    );
    expect(stale).toBeNull();

    const stored = await withTenant(TENANT, () => getDocumentTemplateRepo(TENANT, "cas-key"));
    expect(stored?.template.pageSize).toBe("A4");
  });

  it("rejects an update when the row no longer exists", async () => {
    const current = await withTenant(TENANT, () => getDocumentTemplateRepo(TENANT, "cas-key"));
    expect(current).not.toBeNull();

    // A reset through the delete route removes the row entirely.
    await withTenant(TENANT, async (tx) => {
      await tx
        .delete(documentTemplates)
        .where(inArray(documentTemplates.workspaceSubdomain, [TENANT]));
    });

    const result = await withTenant(TENANT, () =>
      upsertDocumentTemplateRepo(TENANT, "cas-key", template, current!.updatedAt),
    );
    expect(result).toBeNull();
  });
});
