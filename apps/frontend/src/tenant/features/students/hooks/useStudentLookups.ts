import {
  STUDENTS_MODULE_MANIFEST,
  emptyStudentLookupsMap,
  type StudentLookupKind,
  type StudentLookupsMap,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { createModuleLookupsHooks } from "@/lib/query/createModuleLookupsHooks";

export const STUDENTS_LOOKUPS_QUERY_KEY = [
  STUDENTS_MODULE_MANIFEST.collectionKey,
  "lookups",
] as const;

async function fetchStudentLookups(_signal?: AbortSignal): Promise<StudentLookupsMap> {
  const res = await apiContract.students.getLookups({ query: undefined, extraHeaders: {} });
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
