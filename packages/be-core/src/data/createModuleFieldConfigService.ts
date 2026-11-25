import { getRequestTenant, requireTenant } from "../http/tenantContext.js";
import { broadcastCollection } from "../realtime/index.js";

/**
 * Shared field-config load/save: tenant → load → strip on save → reload → broadcast.
 */
export function createModuleFieldConfigService<
  TRaw,
  TDocument extends { formTabs?: TFormTab[]; fields?: unknown },
  TFormTab,
  _TFields,
  TPersist,
>({
  broadcastKey,
  getByWorkspace,
  upsert,
  toDocument,
  stripForPersist,
  reloadFailedMessage,
}: {
  moduleId?: string;
  broadcastKey: string;
  getByWorkspace: (tenant: string) => Promise<TRaw | null | undefined>;
  upsert: (tenant: string, payload: TPersist) => Promise<unknown>;
  mapRow?: unknown;
  merge?: unknown;
  toDocument: (raw: TRaw, tenant: string) => TDocument | Promise<TDocument>;
  stripForPersist: (config: TDocument) => TPersist;
  reloadFailedMessage: string;
}) {
  async function load(): Promise<(TDocument & { formTabs: TFormTab[] }) | null> {
    // Field config is tenant-scoped, but reads must stay graceful outside a
    // request (unit tests, cross-module helpers): `null` means "no config",
    // which every consumer handles (`ContactWriteContext.fieldConfig` is
    // `FieldConfig | null`). `save` still fails closed on a missing tenant.
    const tenant = getRequestTenant();
    if (!tenant) return null;
    const raw = await getByWorkspace(tenant);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const document = await toDocument(raw, tenant);
    return { ...document, formTabs: (document.formTabs ?? []) as TFormTab[] };
  }

  async function save(config: TDocument): Promise<TDocument & { formTabs: TFormTab[] }> {
    const tenant = requireTenant();
    await upsert(tenant, stripForPersist(config));
    const loaded = await load();
    if (!loaded) throw new Error(reloadFailedMessage);
    await broadcastCollection(broadcastKey);
    return loaded;
  }

  return { load, save, requireTenant };
}

export { requireTenant as requireFieldConfigTenant };
