import {
  FACULTY_MODULE_MANIFEST,
  type Faculty,
  type FacultyDuplicateCheckInput,
  type FacultyDuplicateReason,
  type FacultyRecord,
  type FacultyCommandMetricsSnapshot,
} from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";

import { apiContract } from "@/lib/api";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { uniqueRegistryIds } from "@/lib/registryResolve";
import {
  FACULTY_QUERY_KEY,
  type FacultyNextEmployeeIdParams,
  type FacultyWidgetAggregateWidgetInput,
} from "@/tenant/features/faculty/hooks/facultyQueryKeys";
import {
  type FacultyListPageResult,
  type FacultyPaginatedParams,
} from "@/tenant/features/faculty/hooks/facultyListQueryBuilders";

export type {
  FacultyListPageResult,
  FacultyPaginatedParams,
  FacultyNextEmployeeIdParams,
  FacultyWidgetAggregateWidgetInput,
};

export function facultyCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<FacultyCommandMetricsSnapshot>({
    moduleId: FACULTY_MODULE_MANIFEST.moduleId,
    apiPath: FACULTY_MODULE_MANIFEST.restBasePath,
  });
}

/** Fetches all pages matching Work filters for export (parity with Students §8). */
export async function fetchAllFacultyForQuery(
  params: Omit<FacultyPaginatedParams, "page" | "enabled">,
  onProgress?: (fetched: number, total: number) => void,
  messages?: { exportLimitExceeded: string },
): Promise<FacultyRecord[]> {
  const limit = FACULTY_MODULE_MANIFEST.maxPageSize;
  const all: FacultyRecord[] = [];
  let page = 1;
  let total = 0;

  for (;;) {
    const response = await apiContract.faculty.list({
      query: { ...params, page, limit },
    });
    const facultyPage = response.body as FacultyListPageResult;
    const items = (facultyPage.faculty ?? []) as FacultyRecord[];
    all.push(...items);
    total = facultyPage.total;
    onProgress?.(all.length, total);
    if (!facultyPage.hasMore) break;
    if (page >= 200) {
      throw new Error(
        messages?.exportLimitExceeded ??
          "Faculty export exceeds the 100,000-record safety limit; narrow the filters.",
      );
    }
    page += 1;
  }

  return all;
}

export function useFacultyLinkedContactIds(excludeId?: string, enabled = true) {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  return useQuery({
    queryKey: [...FACULTY_QUERY_KEY, "linked-contact-ids", excludeId ?? ""] as const,
    queryFn: async ({ signal }) => {
      const res = await apiContract.faculty.linkedContactIds({
        query: { excludeId },
        fetchOptions: { signal },
      });
      if (res.status !== 200) {
        throw new Error(t("faculty.errors.loadLinkedContactIds"));
      }
      const body = res.body as { contactIds?: Array<string | number> } | undefined;
      return body?.contactIds ?? [];
    },
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  });
}

/** Resolve faculty members by id — shared by {@link useFacultyByIds} and imperative `fetchQuery` callers. */
export function facultyResolveQueryOptions(ids: (string | number | null | undefined)[]) {
  const normalized = uniqueRegistryIds(ids);
  return queryOptions({
    queryKey: [...FACULTY_QUERY_KEY, "resolve", normalized.join(",")] as const,
    queryFn: async ({ signal }) => {
      const res = await apiContract.faculty.resolve({
        body: { ids: normalized },
        fetchOptions: { signal },
      });
      const body = res.body as { faculty?: Faculty[] } | null;
      return body?.faculty;
    },
    enabled: normalized.length > 0,
    staleTime: 30_000,
  });
}

export function useFacultyByIds(ids: (string | number | null | undefined)[]) {
  const { isAuthenticated } = useAuth();
  const options = facultyResolveQueryOptions(ids);
  const query = useQuery({ ...options, enabled: isAuthenticated && options.enabled === true });

  return { ...query, data: query.data };
}

export function useFacultyNextEmployeeId(params: FacultyNextEmployeeIdParams = {}) {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const enabled = params.enabled ?? true;

  return useQuery({
    queryKey: [...FACULTY_QUERY_KEY, "next-employee-id", params] as const,
    queryFn: async ({ signal }) => {
      const res = await apiContract.faculty.nextEmployeeId({
        query: {
          prefix: params.prefix,
          template: params.template,
          digits: params.digits,
          startSeq: params.startSeq,
          restartAnnually: params.restartAnnually,
        },
        fetchOptions: { signal },
      });
      if (res.status !== 200) {
        throw new Error(t("faculty.errors.loadNextEmployeeId"));
      }
      const body = res.body as { employeeId?: string } | undefined;
      return typeof body?.employeeId === "string" ? body.employeeId : "";
    },
    enabled: isAuthenticated && enabled,
    staleTime: 15_000,
  });
}

/** Server-authoritative active duplicate probe (contact / employeeId) before save. */
export async function checkFacultyRegistrationDuplicate(
  input: FacultyDuplicateCheckInput,
  messages?: { duplicateCheckFailed: string },
): Promise<FacultyDuplicateReason | null> {
  const res = await apiContract.faculty.duplicateCheck({ body: input });
  if (res.status !== 200) {
    throw new Error(messages?.duplicateCheckFailed ?? "Duplicate check failed");
  }
  return (res.body as { reason?: FacultyDuplicateReason | null } | null)?.reason ?? null;
}

export function useFacultyMetrics(options?: { enabled?: boolean }) {
  return useServerMetrics<FacultyCommandMetricsSnapshot>({
    moduleId: FACULTY_MODULE_MANIFEST.moduleId,
    apiPath: FACULTY_MODULE_MANIFEST.restBasePath,
    enabled: options?.enabled,
  });
}

export {
  facultyWidgetAggregatesQueryOptions,
  useFacultyWidgetAggregates,
} from "@/tenant/features/faculty/hooks/useFacultyWidgetAggregates";

/** One-shot employee-id backfill for active faculty missing one (Setup writers). */
export async function migrateFacultyEmployeeIds(messages?: {
  migrationFailed: string;
}): Promise<{ updated: number }> {
  const res = await apiContract.faculty.migrateEmployeeIds({ body: {} });
  if (res.status !== 200) {
    throw new Error(messages?.migrationFailed ?? "Migration failed");
  }
  return { updated: (res.body as { updated?: number } | null)?.updated ?? 0 };
}
