import { findWorkspaceTimezone } from "../db/repositories/workspaceRepository.js";

/** Workspace IANA timezone, falling back to UTC; used by exports and report day math. */
export async function getWorkspaceTimezone(tenant: string): Promise<string> {
  const timeZone = await findWorkspaceTimezone(tenant.trim().toLowerCase());
  return timeZone?.trim() || "UTC";
}
