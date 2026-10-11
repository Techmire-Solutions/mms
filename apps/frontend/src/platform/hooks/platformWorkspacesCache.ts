import type { PlatformWorkspaceRow } from "@mms/shared";

export function updateWorkspacesCache(
  old: unknown,
  subdomain: string,
  patch: Partial<PlatformWorkspaceRow>,
): unknown {
  if (!old || typeof old !== "object") return old;
  const asTsr = old as {
    body?: { workspaces?: PlatformWorkspaceRow[] };
    workspaces?: PlatformWorkspaceRow[];
  };
  if (asTsr.body && Array.isArray(asTsr.body.workspaces)) {
    return {
      ...asTsr,
      body: {
        ...asTsr.body,
        workspaces: asTsr.body.workspaces.map((w) =>
          w.subdomain === subdomain ? { ...w, ...patch } : w,
        ),
      },
    };
  }
  if (Array.isArray(asTsr.workspaces)) {
    return {
      ...asTsr,
      workspaces: asTsr.workspaces.map((w) => (w.subdomain === subdomain ? { ...w, ...patch } : w)),
    };
  }
  if (Array.isArray(old)) {
    return (old as PlatformWorkspaceRow[]).map((w) =>
      w.subdomain === subdomain ? { ...w, ...patch } : w,
    );
  }
  return old;
}
