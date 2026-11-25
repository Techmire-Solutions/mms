import { eq } from "drizzle-orm";
import { activeDb } from "./client.js";
import { workspaces as workspacesTable } from "./schema.js";

/** The configured IANA timezone for a workspace, or null when unset. */
export async function findWorkspaceTimezone(subdomain: string): Promise<string | null> {
  const [row] = await activeDb()
    .select({ timezone: workspacesTable.timezone })
    .from(workspacesTable)
    .where(eq(workspacesTable.subdomain, subdomain.trim().toLowerCase()))
    .limit(1);
  return row?.timezone ?? null;
}
