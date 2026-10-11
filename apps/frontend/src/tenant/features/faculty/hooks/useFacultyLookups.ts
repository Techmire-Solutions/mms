import {
  FACULTY_MODULE_MANIFEST,
  emptyFacultyLookupsMap,
  type FacultyLookupKind,
  type FacultyLookupsMap,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { createModuleLookupsHooks } from "@/lib/query/createModuleLookupsHooks";

export const FACULTY_LOOKUPS_QUERY_KEY = [
  FACULTY_MODULE_MANIFEST.collectionKey,
  "lookups",
] as const;

export async function fetchFacultyLookups(_signal?: AbortSignal): Promise<FacultyLookupsMap> {
  const res = await apiContract.faculty.getLookups({ query: undefined, extraHeaders: {} });
  return (res.body as { lookups?: FacultyLookupsMap }).lookups ?? emptyFacultyLookupsMap();
}

export async function putFacultyLookupKind(
  kind: FacultyLookupKind,
  items: string[],
): Promise<string[]> {
  const res = await apiContract.faculty.updateLookupKind({
    params: { kind },
    body: { items },
    query: undefined,
    extraHeaders: {},
  });
  return (res.body as { items?: string[] }).items ?? [];
}

const lookupsHooks = createModuleLookupsHooks<FacultyLookupsMap, FacultyLookupKind, string[]>({
  queryKey: FACULTY_LOOKUPS_QUERY_KEY,
  fetchLookups: fetchFacultyLookups,
  putLookupKind: putFacultyLookupKind,
  defaults: emptyFacultyLookupsMap,
});

export const useFacultyLookupsQuery = lookupsHooks.useLookupsQuery;
export const useFacultyLookupMutation = lookupsHooks.useLookupMutation;
