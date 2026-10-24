import { requireTenant } from "./tenantContext.js";
import { broadcastCollection } from "./livePush.js";

/**
 * Shared module-preferences load/save: tenant → load → normalize → upsert → broadcast.
 * Faculty/Students (and future person modules) use this as their thin adapter.
 */
export function createModulePreferencesService<TPreferences>({
  broadcastKey,
  getByWorkspace,
  upsert,
  normalize,
}: {
  broadcastKey: string;
  getByWorkspace: (tenant: string) => Promise<Record<string, unknown> | null>;
  upsert: (tenant: string, payload: Record<string, unknown>) => Promise<unknown>;
  normalize: (value: TPreferences | Record<string, unknown> | null | undefined) => TPreferences;
}) {
  async function load(): Promise<TPreferences | null> {
    const raw = await getByWorkspace(requireTenant());
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    return normalize(raw);
  }

  async function save(preferences: TPreferences | Record<string, unknown>): Promise<TPreferences> {
    const tenant = requireTenant();
    const normalized = normalize(preferences);
    await upsert(tenant, Object.assign({}, normalized));
    await broadcastCollection(broadcastKey);
    return normalized;
  }

  return { load, save };
}
