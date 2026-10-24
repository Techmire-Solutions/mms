import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  WORKSHOPS_MODULE_MANIFEST,
  workshopAttendanceRecordSchema,
  workshopDetailSchema,
  workshopEventRecordSchema,
  workshopParticipantRecordSchema,
  workshopScoreRecordSchema,
  workshopsPageResponseSchema,
  type WorkshopAttendanceDayBody,
  type WorkshopEventCreate,
  type WorkshopEventUpdate,
  type WorkshopScoresBody,
  type WorkshopsCommandMetricsSnapshot,
} from "@mms/shared";
import { z } from "zod";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { useServerMetrics } from "@/hooks/useServerMetrics";
import {
  WORKSHOPS_LIST_QUERY_KEY,
  WORKSHOPS_QUERY_KEY,
  WORKSHOP_DETAIL_QUERY_KEY,
} from "./workshopsQueryKeys";

/** Parses a 2xx body with `schema`; anything else becomes an {@link ApiError}. */
function read<T>(
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

/** Lists, detail and metrics all live under the module key, so one prefix refreshes them all. */
export function invalidateWorkshopsQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: WORKSHOPS_QUERY_KEY });
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
function useWorkshopsMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Returning the promise makes `mutateAsync` settle only once fresh data is loaded.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKSHOPS_QUERY_KEY }),
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
  useWorkshopsMutation(async ({ id, contactId }: { id: string; contactId: string }) =>
    read(
      await apiContract.workshops.addParticipant({ params: { id }, body: { contactId } }),
      z.object({ participant: workshopParticipantRecordSchema }),
      "Failed to register the participant",
    ),
  );

export const useRemoveWorkshopParticipant = () =>
  useWorkshopsMutation(async ({ id, participantId }: { id: string; participantId: string }) =>
    read(
      await apiContract.workshops.removeParticipant({ params: { id, participantId }, body: {} }),
      successSchema,
      "Failed to withdraw the participant",
    ),
  );

export const useSaveWorkshopAttendance = () =>
  useWorkshopsMutation(async ({ id, body }: { id: string; body: WorkshopAttendanceDayBody }) =>
    read(
      await apiContract.workshops.saveAttendanceDay({ params: { id }, body }),
      z.object({ attendance: z.array(workshopAttendanceRecordSchema) }),
      "Failed to save check-ins",
    ),
  );

export const useSaveWorkshopScores = () =>
  useWorkshopsMutation(async ({ id, body }: { id: string; body: WorkshopScoresBody }) =>
    read(
      await apiContract.workshops.saveScores({ params: { id }, body }),
      z.object({ scores: z.array(workshopScoreRecordSchema) }),
      "Failed to save scores",
    ),
  );
