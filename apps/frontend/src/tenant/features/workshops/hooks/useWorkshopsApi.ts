import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  WORKSHOPS_MODULE_MANIFEST,
  workshopAttendanceRecordSchema,
  workshopDetailSchema,
  workshopEventRecordSchema,
  workshopParticipantSummarySchema,
  workshopScoreRecordSchema,
  workshopsPageResponseSchema,
  type WorkshopAttendanceDayBody,
  type WorkshopEventCreate,
  type WorkshopEventUpdate,
  type WorkshopScoresBody,
  type WorkshopStatus,
  type WorkshopsCommandMetricsSnapshot,
} from "@mms/shared";
import { z } from "zod";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { useServerMetrics } from "@/hooks/useServerMetrics";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@/lib/query/dashboardQueryKeys";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@/lib/query/dynamicWidgetAggregatesQueryKey";
import {
  WORKSHOPS_LIST_QUERY_KEY,
  WORKSHOPS_PREFERENCES_QUERY_KEY,
  WORKSHOPS_QUERY_KEY,
  WORKSHOPS_REPORT_QUERY_KEY,
  WORKSHOP_COMPLETION_QUERY_KEY,
  WORKSHOP_DETAIL_QUERY_KEY,
} from "./workshopsQueryKeys";

/** Parses a 2xx body with `schema`; anything else becomes an {@link ApiError}. */
export function read<T>(
  response: { status: number; body: unknown },
  schema: z.ZodType<T>,
  context: string,
): T {
  if (response.status >= 200 && response.status < 300) return schema.parse(response.body);
  const parsed = z
    .object({ message: z.string(), type: z.string() })
    .partial()
    .safeParse(response.body);
  const error = parsed.success ? parsed.data : {};
  throw new ApiError(response.status, error.message ?? context, error.type);
}

const successSchema = z.object({ success: z.literal(true) }).passthrough();

type QueryClientLike = ReturnType<typeof useQueryClient>;

const LIST_KEY = [...WORKSHOPS_QUERY_KEY, "list"] as const;
const METRICS_KEY = [...WORKSHOPS_QUERY_KEY, "metrics"] as const;

function invalidateKeys(queryClient: QueryClientLike, keys: QueryKey[]): Promise<void> {
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))).then(
    () => undefined,
  );
}

/** Dashboard KPIs and dynamic report widgets aggregate module data; refresh them with local writes. */
function invalidateCrossModuleAggregates(queryClient: QueryClientLike): Promise<void> {
  return invalidateKeys(queryClient, [
    DASHBOARD_SUMMARY_QUERY_KEY_ROOT,
    DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY,
  ]);
}

/** Full module refresh (list/detail/completion/report/preferences/metrics) plus dashboard widgets. */
export function invalidateWorkshopsQueries(queryClient: QueryClientLike): Promise<void> {
  return invalidateKeys(queryClient, [WORKSHOPS_QUERY_KEY]).then(() =>
    invalidateCrossModuleAggregates(queryClient),
  );
}

/** Participant changes alter seat counters/metrics/metrics + roster/completion/report. */
export function invalidateWorkshopRosterQueries(
  queryClient: QueryClientLike,
  id: string,
): Promise<void> {
  return invalidateKeys(queryClient, [
    LIST_KEY,
    METRICS_KEY,
    WORKSHOP_DETAIL_QUERY_KEY(id),
    WORKSHOP_COMPLETION_QUERY_KEY(id),
    WORKSHOPS_REPORT_QUERY_KEY,
  ]).then(() => invalidateCrossModuleAggregates(queryClient));
}

/** Attendance/scores affect standing and reports, not the list/counters/preferences. */
export function invalidateWorkshopActivityQueries(
  queryClient: QueryClientLike,
  id: string,
): Promise<void> {
  return invalidateKeys(queryClient, [
    WORKSHOP_DETAIL_QUERY_KEY(id),
    WORKSHOP_COMPLETION_QUERY_KEY(id),
    WORKSHOPS_REPORT_QUERY_KEY,
  ]).then(() => invalidateCrossModuleAggregates(queryClient));
}

/** Setup defaults are independent of the roster/list. */
export function invalidateWorkshopPreferenceQueries(queryClient: QueryClientLike): Promise<void> {
  return invalidateKeys(queryClient, [WORKSHOPS_PREFERENCES_QUERY_KEY]);
}

export function useWorkshops(params: { includeDeleted: boolean; search: string }) {
  return useQuery({
    queryKey: WORKSHOPS_LIST_QUERY_KEY(params),
    queryFn: async ({ signal }) => {
      const response = await apiContract.workshops.listWorkshops({
        query: {
          limit: WORKSHOPS_MODULE_MANIFEST.maxPageSize,
          ...(params.search.trim() ? { search: params.search.trim() } : {}),
          ...(params.includeDeleted ? { includeDeleted: "true" as const } : {}),
        },
        fetchOptions: { signal },
      });
      return read(response, workshopsPageResponseSchema, "Failed to load workshops");
    },
    staleTime: 15_000,
  });
}

export function useWorkshopDetail(id: string | null) {
  return useQuery({
    queryKey: WORKSHOP_DETAIL_QUERY_KEY(id ?? ""),
    queryFn: async ({ signal }) => {
      const response = await apiContract.workshops.getWorkshop({
        params: { id: id ?? "" },
        fetchOptions: { signal },
      });
      return read(response, workshopDetailSchema, "Failed to load the workshop");
    },
    enabled: Boolean(id),
  });
}

export function useWorkshopMetrics(options: { enabled?: boolean } = {}) {
  return useServerMetrics<WorkshopsCommandMetricsSnapshot>({
    moduleId: WORKSHOPS_MODULE_MANIFEST.moduleId,
    apiPath: WORKSHOPS_MODULE_MANIFEST.restBasePath,
    enabled: options.enabled,
  });
}

/** Every workshop mutation refreshes the module's lists, detail and metrics before it settles. */
export function useWorkshopsMutation<TVars, TResult>(
  mutationFn: (vars: TVars) => Promise<TResult>,
  invalidate?: (queryClient: QueryClientLike, vars: TVars, result: TResult) => Promise<void> | void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Returning the promise makes `mutateAsync` settle only once fresh data is loaded.
    onSuccess: async (result, vars) => {
      if (invalidate) await invalidate(queryClient, vars, result);
      else await invalidateWorkshopsQueries(queryClient);
    },
  });
}

const workshopEnvelope = z.object({ workshop: workshopEventRecordSchema });

export const useCreateWorkshop = () =>
  useWorkshopsMutation(async (body: WorkshopEventCreate) =>
    read(
      await apiContract.workshops.createWorkshop({ body }),
      workshopEnvelope,
      "Failed to create the workshop",
    ),
  );

export const useUpdateWorkshop = () =>
  useWorkshopsMutation(async ({ id, body }: { id: string; body: WorkshopEventUpdate }) =>
    read(
      await apiContract.workshops.updateWorkshop({ params: { id }, body }),
      workshopEnvelope,
      "Failed to update the workshop",
    ),
  );

/**
 * Lifecycle transitions are the only way a workshop's status moves. The OCC token is the
 * `updatedAt` the caller read, so a second administrator acting on a stale drawer gets a 409
 * instead of silently overwriting the first decision.
 */
export const useTransitionWorkshop = () =>
  useWorkshopsMutation(
    async ({
      id,
      to,
      reason,
      expectedUpdatedAt,
    }: {
      id: string;
      to: WorkshopStatus;
      reason?: string;
      expectedUpdatedAt: string;
    }) =>
      read(
        await apiContract.workshops.transitionWorkshop({
          params: { id },
          body: { to, ...(reason ? { reason } : {}) },
          extraHeaders: { "x-expected-updated-at": expectedUpdatedAt },
        }),
        workshopEnvelope,
        "Failed to change the workshop lifecycle",
      ),
  );

export const useDeleteWorkshop = () =>
  useWorkshopsMutation(async (id: string) =>
    read(
      await apiContract.workshops.deleteWorkshop({ params: { id }, body: {} }),
      successSchema,
      "Failed to delete the workshop",
    ),
  );

export const useRestoreWorkshop = () =>
  useWorkshopsMutation(async (id: string) =>
    read(
      await apiContract.workshops.restoreWorkshop({ params: { id }, body: {} }),
      successSchema,
      "Failed to restore the workshop",
    ),
  );

export const useAddWorkshopParticipant = () =>
  useWorkshopsMutation(
    async ({ id, contactId }: { id: string; contactId: string }) =>
      read(
        await apiContract.workshops.addParticipant({ params: { id }, body: { contactId } }),
        z.object({ participant: workshopParticipantSummarySchema }),
        "Failed to register the participant",
      ),
    (queryClient, { id }) => invalidateWorkshopRosterQueries(queryClient, id),
  );

const withdrawalSchema = z.object({
  success: z.literal(true),
  promoted: workshopParticipantSummarySchema.nullable(),
});

export const useRemoveWorkshopParticipant = () =>
  useWorkshopsMutation(
    async ({ id, participantId }: { id: string; participantId: string }) =>
      read(
        await apiContract.workshops.removeParticipant({
          params: { id, participantId },
          body: {},
        }),
        withdrawalSchema,
        "Failed to withdraw the participant",
      ),
    (queryClient, { id }) => invalidateWorkshopRosterQueries(queryClient, id),
  );

export const useSaveWorkshopAttendance = () =>
  useWorkshopsMutation(
    async ({ id, body }: { id: string; body: WorkshopAttendanceDayBody }) =>
      read(
        await apiContract.workshops.saveAttendanceDay({ params: { id }, body }),
        z.object({ attendance: z.array(workshopAttendanceRecordSchema) }),
        "Failed to save check-ins",
      ),
    (queryClient, { id }) => invalidateWorkshopActivityQueries(queryClient, id),
  );

export const useSaveWorkshopScores = () =>
  useWorkshopsMutation(
    async ({ id, body }: { id: string; body: WorkshopScoresBody }) =>
      read(
        await apiContract.workshops.saveScores({ params: { id }, body }),
        z.object({ scores: z.array(workshopScoreRecordSchema) }),
        "Failed to save scores",
      ),
    (queryClient, { id }) => invalidateWorkshopActivityQueries(queryClient, id),
  );
