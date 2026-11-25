import {
  STUDENTS_MODULE_MANIFEST,
  emptyStudentLookupsMap,
  type StudentLookupKind,
  type StudentLookupsMap,
} from "@mms/contracts";
import { apiContract } from "@mms/fe-core/api/tsRest";
import { createModuleLookupsHooks } from "@mms/fe-core/lib/createModuleLookupsHooks";

export const STUDENTS_LOOKUPS_QUERY_KEY = [
  STUDENTS_MODULE_MANIFEST.collectionKey,
  "lookups",
] as const;

async function fetchStudentLookups(signal?: AbortSignal): Promise<StudentLookupsMap> {
  const res = await apiContract.students.getLookups({
    query: undefined,
    extraHeaders: {},
    signal,
    fetchOptions: { signal },
  });
  return (res.body as { lookups?: StudentLookupsMap }).lookups ?? emptyStudentLookupsMap();
}

async function putStudentLookupKind(kind: StudentLookupKind, items: string[]): Promise<string[]> {
  const res = await apiContract.students.updateLookupKind({
    params: { kind },
    body: { items },
    query: undefined,
    extraHeaders: {},
  });
  return (res.body as { items?: string[] }).items ?? [];
}

const lookupsHooks = createModuleLookupsHooks<StudentLookupsMap, StudentLookupKind, string[]>({
  queryKey: STUDENTS_LOOKUPS_QUERY_KEY,
  fetchLookups: fetchStudentLookups,
  putLookupKind: putStudentLookupKind,
  defaults: emptyStudentLookupsMap,
});

export const useStudentLookupsQuery = lookupsHooks.useLookupsQuery;
export const useStudentLookupMutation = lookupsHooks.useLookupMutation;
