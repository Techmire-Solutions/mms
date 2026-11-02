import { and, eq } from "drizzle-orm";
import type { DocumentTemplate } from "@mms/shared";
import { activeDb } from "../dbConnection.js";
import { documentTemplates } from "../schema.js";

/** Stored layout plus the version token clients must echo when saving. */
export interface StoredDocumentTemplate {
  template: DocumentTemplate;
  updatedAt: Date;
}

/** Reads a document template for the tenant by key. */
export async function getDocumentTemplateRepo(
  tenant: string,
  key: string,
): Promise<StoredDocumentTemplate | null> {
  const [row] = await activeDb()
    .select({ template: documentTemplates.template, updatedAt: documentTemplates.updatedAt })
    .from(documentTemplates)
    .where(and(eq(documentTemplates.workspaceSubdomain, tenant), eq(documentTemplates.key, key)));
  if (!row) return null;
  return { template: row.template as DocumentTemplate, updatedAt: row.updatedAt };
}

/**
 * Inserts or updates a document template with compare-and-set on `updated_at`.
 *
 * `expectedUpdatedAt === null` means the caller read no stored layout, so only an
 * insert is acceptable; a row created by someone else in between is a conflict.
 * Returns `null` when the expectation no longer matches — the caller maps that to
 * `409 Conflict` and the stored layout is left untouched.
 *
 * Atomic per statement (no read-then-write window). All writers set `updatedAt` from
 * a JS `Date` (millisecond precision), which is exactly what the client echoes back,
 * so timestamp equality is exact.
 */
export async function upsertDocumentTemplateRepo(
  tenant: string,
  key: string,
  template: DocumentTemplate,
  expectedUpdatedAt: Date | null,
): Promise<StoredDocumentTemplate | null> {
  const now = new Date();

  if (expectedUpdatedAt === null) {
    const [row] = await activeDb()
      .insert(documentTemplates)
      .values({
        workspaceSubdomain: tenant,
        key,
        template,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [documentTemplates.workspaceSubdomain, documentTemplates.key],
      })
      .returning({ template: documentTemplates.template, updatedAt: documentTemplates.updatedAt });
    return row ? { template: row.template as DocumentTemplate, updatedAt: row.updatedAt } : null;
  }

  const [row] = await activeDb()
    .update(documentTemplates)
    .set({ template, updatedAt: now })
    .where(
      and(
        eq(documentTemplates.workspaceSubdomain, tenant),
        eq(documentTemplates.key, key),
        eq(documentTemplates.updatedAt, expectedUpdatedAt),
      ),
    )
    .returning({ template: documentTemplates.template, updatedAt: documentTemplates.updatedAt });

  return row ? { template: row.template as DocumentTemplate, updatedAt: row.updatedAt } : null;
}

/** Deletes a custom document template by key (reverting to default/fallback). */
export async function deleteDocumentTemplateRepo(tenant: string, key: string): Promise<boolean> {
  const result = await activeDb()
    .delete(documentTemplates)
    .where(and(eq(documentTemplates.workspaceSubdomain, tenant), eq(documentTemplates.key, key)));
  return (result.rowCount ?? 0) > 0;
}

/** Lists all custom document templates for a tenant. */
export async function listDocumentTemplatesRepo(
  tenant: string,
): Promise<Array<{ key: string; template: DocumentTemplate; updatedAt: Date }>> {
  const rows = await activeDb()
    .select({
      key: documentTemplates.key,
      template: documentTemplates.template,
      updatedAt: documentTemplates.updatedAt,
    })
    .from(documentTemplates)
    .where(eq(documentTemplates.workspaceSubdomain, tenant));

  return rows.map((r) => ({
    key: r.key,
    template: r.template as DocumentTemplate,
    updatedAt: r.updatedAt,
  }));
}
