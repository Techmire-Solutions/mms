import { ACADEMIC_CATALOG_KINDS, DEFAULT_ACADEMIC_CATALOG_SEEDS, uuidv7 } from "@mms/shared";
import { withTenant } from "../tenant-context.js";
import { ACADEMIC_CATALOG_TABLES } from "./academicCatalogRepository.js";

/** Seeds system session categories, programs and subjects for a new workspace (idempotent). */
export async function seedAcademicCatalogDefaults(tenant: string): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    for (const kind of ACADEMIC_CATALOG_KINDS) {
      const { table } = ACADEMIC_CATALOG_TABLES[kind];
      const rows = DEFAULT_ACADEMIC_CATALOG_SEEDS[kind].map((seed, sortOrder) => ({
        id: uuidv7(),
        workspaceSubdomain: subdomain,
        code: seed.code,
        name: seed.name,
        sortOrder,
        isSystem: true,
      }));
      await tx.insert(table).values(rows).onConflictDoNothing();
    }
  });
}
