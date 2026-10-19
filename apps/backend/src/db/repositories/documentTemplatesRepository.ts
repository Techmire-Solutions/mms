import { and, eq } from "drizzle-orm";
import type { DocumentTemplate } from "@mms/shared";
import { activeDb } from "../dbConnection.js";
import { documentTemplates } from "../schema.js";

/** Reads a document template for the tenant by key. */
export async function getDocumentTemplateRepo(
  tenant: string,
  key: string,
): Promise<DocumentTemplate | null> {
  const [row] = await activeDb()
    .select({ template: documentTemplates.template })
    .from(documentTemplates)
    .where(
      and(
        eq(documentTemplates.workspaceSubdomain, tenant),
        eq(documentTemplates.key, key),
      ),
    );
  return (row?.template as DocumentTemplate | undefined) ?? null;
}

/** Inserts or updates a document template for the tenant. */
export async function upsertDocumentTemplateRepo(
  tenant: string,
  key: string,
  template: DocumentTemplate,
): Promise<DocumentTemplate> {
  const [row] = await activeDb()
    .insert(documentTemplates)
    .values({
      workspaceSubdomain: tenant,
      key,
      template,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [documentTemplates.workspaceSubdomain, documentTemplates.key],
      set: {
        template,
        updatedAt: new Date(),
      },
    })
    .returning({ template: documentTemplates.template });

  return (row?.template as DocumentTemplate | undefined) ?? template;
}

/** Deletes a custom document template by key (reverting to default/fallback). */
export async function deleteDocumentTemplateRepo(
  tenant: string,
  key: string,
): Promise<boolean> {
  const result = await activeDb()
    .delete(documentTemplates)
    .where(
      and(
        eq(documentTemplates.workspaceSubdomain, tenant),
        eq(documentTemplates.key, key),
      ),
    );
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
