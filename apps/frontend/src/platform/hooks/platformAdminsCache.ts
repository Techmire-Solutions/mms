import type { PlatformUserProfile } from "@mms/shared";

export function updateAdminsCache(
  old: unknown,
  adminId: string,
  patch: Partial<PlatformUserProfile>,
): unknown {
  if (!old || typeof old !== "object") return old;
  const asTsr = old as { body?: { users?: PlatformUserProfile[] }; users?: PlatformUserProfile[] };
  if (asTsr.body && Array.isArray(asTsr.body.users)) {
    return {
      ...asTsr,
      body: {
        ...asTsr.body,
        users: asTsr.body.users.map((u) => (u.id === adminId ? { ...u, ...patch } : u)),
      },
    };
  }
  if (Array.isArray(asTsr.users)) {
    return {
      ...asTsr,
      users: asTsr.users.map((u) => (u.id === adminId ? { ...u, ...patch } : u)),
    };
  }
  if (Array.isArray(old)) {
    return (old as PlatformUserProfile[]).map((u) => (u.id === adminId ? { ...u, ...patch } : u));
  }
  return old;
}
