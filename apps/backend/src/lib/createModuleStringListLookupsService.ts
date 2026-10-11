import { slugifyLookupLabel } from "./slugifyLookupLabel.js";
import { getRequestTenant } from "./tenantContext.js";
import { broadcastCollection } from "./livePush.js";
import { getOrSetMultiTier, invalidateMultiTierCache } from "./cache/index.js";

type StringLookupRow = { kind: string; label: string };

function rowsToStringItems(rows: Array<{ label: string }>): string[] {
  return rows.map((row) => row.label).filter(Boolean);
}

/**
 * Shared load/replace for module string-list lookups (genders, statuses, labels, …).
 * Contacts countryCodes and relationship mirrors stay outside this factory.
 */
export function createModuleStringListLookupsService<
  TKind extends string,
  TMap extends Record<TKind, string[]>,
>({
  kinds,
  emptyMap,
  defaultItems,
  listByWorkspace,
  listByKind,
  replaceForKind,
  broadcastKey,
}: {
  kinds: readonly TKind[];
  emptyMap: () => TMap;
  defaultItems: (kind: TKind) => string[];
  listByWorkspace: (tenant: string) => Promise<StringLookupRow[]>;
  listByKind: (tenant: string, kind: TKind) => Promise<Array<{ label: string }>>;
  replaceForKind: (
    tenant: string,
    kind: TKind,
    rows: Array<{
      id: string;
      kind: TKind;
      label: string;
      meta: Record<string, unknown> | null;
      sortOrder: number;
    }>,
  ) => Promise<void>;
  broadcastKey: string;
}) {
  async function loadMap(tenant = getRequestTenant()): Promise<TMap> {
    const empty = emptyMap();
    if (!tenant) return empty;

    return getOrSetMultiTier(
      tenant,
      "lookups",
      `${broadcastKey}:map`,
      async () => {
        const rows = await listByWorkspace(tenant);
        const byKind = new Map<string, StringLookupRow[]>();
        for (const row of rows) {
          const list = byKind.get(row.kind) ?? [];
          list.push(row);
          byKind.set(row.kind, list);
        }

        const result = { ...empty };
        for (const kind of kinds) {
          const kindRows = byKind.get(kind) ?? [];
          if (kindRows.length === 0) continue;
          result[kind] = rowsToStringItems(kindRows) as TMap[TKind];
        }
        return result;
      },
      { ttlSeconds: 300 },
    );
  }

  async function loadKind(kind: TKind, tenant = getRequestTenant()): Promise<string[]> {
    if (!tenant) return defaultItems(kind);
    return getOrSetMultiTier(
      tenant,
      "lookups",
      `${broadcastKey}:${kind}`,
      async () => {
        const rows = await listByKind(tenant, kind);
        if (rows.length === 0) return defaultItems(kind);
        return rowsToStringItems(rows);
      },
      { ttlSeconds: 300 },
    );
  }

  async function replaceKind(
    kind: TKind,
    items: string[],
    tenant = getRequestTenant(),
  ): Promise<string[]> {
    if (!tenant) throw new Error("Tenant context required");

    const labels = items.map((label) => label.trim()).filter(Boolean);
    const rowsToSave: Array<{
      id: string;
      kind: TKind;
      label: string;
      meta: Record<string, unknown> | null;
      sortOrder: number;
    }> = labels.map((label, index) => ({
      id: `${tenant}:${kind}:${slugifyLookupLabel(label, index)}`,
      kind,
      label,
      meta: null,
      sortOrder: index,
    }));

    if (rowsToSave.length === 0) {
      rowsToSave.push({
        id: `${tenant}:${kind}:__empty__`,
        kind,
        label: "",
        meta: { empty: true },
        sortOrder: 0,
      });
    }

    await replaceForKind(tenant, kind, rowsToSave);
    await invalidateMultiTierCache({
      tenantId: tenant,
      domain: "lookups",
      key: `${broadcastKey}:${kind}`,
    });
    await invalidateMultiTierCache({
      tenantId: tenant,
      domain: "lookups",
      key: `${broadcastKey}:map`,
    });
    await broadcastCollection(broadcastKey);
    return labels;
  }

  return { loadMap, loadKind, replaceKind };
}
