import { eq } from "drizzle-orm";
import { activeDb } from "@mms/db/client";
import { workspaces } from "@mms/db/schema";

export async function loadWorkspaceName(tenant: string): Promise<string | null> {
  const rows = await activeDb()
    .select({ name: workspaces.madrasaName })
    .from(workspaces)
    .where(eq(workspaces.subdomain, tenant.trim().toLowerCase()))
    .limit(1);
  return rows[0]?.name?.trim() || null;
}
