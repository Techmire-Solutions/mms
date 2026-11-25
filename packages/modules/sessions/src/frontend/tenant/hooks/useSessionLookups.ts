import {
  SESSIONS_MODULE_MANIFEST,
  emptySessionLookupsMap,
  type SessionLookupKind,
  type SessionLookupsMap,
} from "@mms/contracts";
import { apiContract } from "@mms/fe-core/api/tsRest";
import { assertContractOk } from "@mms/fe-core/api/contractError";
import { createModuleLookupsHooks } from "@mms/fe-core/lib/createModuleLookupsHooks";

export const SESSIONS_LOOKUPS_QUERY_KEY = [
  SESSIONS_MODULE_MANIFEST.collectionKey,
  "lookups",
] as const;

export async function fetchSessionLookups(signal?: AbortSignal): Promise<SessionLookupsMap> {
  const res = await apiContract.sessions.getLookups({
    query: undefined,
    extraHeaders: {},
    signal,
    fetchOptions: { signal },
  });
  assertContractOk(res, "Failed to load session lookups");
  return (res.body as { lookups?: SessionLookupsMap }).lookups ?? emptySessionLookupsMap;
}

export async function putSessionLookupKind(
  kind: SessionLookupKind,
  items: string[],
): Promise<string[]> {
  const res = await apiContract.sessions.updateLookupKind({
    params: { kind },
    body: { items },
    query: undefined,
    extraHeaders: {},
  });
  assertContractOk(res, "Failed to save session lookups");
  return (res.body as { items?: string[] }).items ?? [];
}

const lookupsHooks = createModuleLookupsHooks<SessionLookupsMap, SessionLookupKind, string[]>({
  queryKey: SESSIONS_LOOKUPS_QUERY_KEY,
  fetchLookups: fetchSessionLookups,
  putLookupKind: putSessionLookupKind,
  defaults: () => emptySessionLookupsMap,
});

export const useSessionLookupsQuery = lookupsHooks.useLookupsQuery;
