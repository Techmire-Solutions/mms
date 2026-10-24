import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  workshopCompletionRowSchema,
  workshopPreferencesSchema,
  workshopReportRowSchema,
  type WorkshopPreferences,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { read, useWorkshopsMutation } from "./useWorkshopsApi";
import {
  WORKSHOP_COMPLETION_QUERY_KEY,
  WORKSHOPS_PREFERENCES_QUERY_KEY,
  WORKSHOPS_REPORT_QUERY_KEY,
} from "./workshopsQueryKeys";

const rowsSchema = z.object({ rows: z.array(workshopCompletionRowSchema) });

export function useWorkshopCompletion(id: string | null) {
  return useQuery({
    queryKey: WORKSHOP_COMPLETION_QUERY_KEY(id ?? ""),
    queryFn: async ({ signal }) =>
      read(
        await apiContract.workshopsCompletion.getCompletion({
          params: { id: id ?? "" },
          fetchOptions: { signal },
        }),
        rowsSchema,
        "Failed to load completion",
      ).rows,
    enabled: Boolean(id),
  });
}

export const useEvaluateWorkshopCompletion = () =>
  useWorkshopsMutation(async (id: string) =>
    read(
      await apiContract.workshopsCompletion.evaluateCompletion({ params: { id }, body: {} }),
      rowsSchema,
      "Failed to evaluate completion",
    ),
  );

export const useIssueWorkshopCertificates = () =>
  useWorkshopsMutation(async ({ id, participantIds }: { id: string; participantIds: string[] }) =>
    read(
      await apiContract.workshopsCompletion.issueCertificates({
        params: { id },
        body: { participantIds },
      }),
      rowsSchema.extend({ issued: z.array(z.string()) }),
      "Failed to issue certificates",
    ),
  );

export function useWorkshopsReport(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: WORKSHOPS_REPORT_QUERY_KEY,
    queryFn: async ({ signal }) =>
      read(
        await apiContract.workshopsCompletion.getReport({ fetchOptions: { signal } }),
        z.object({ rows: z.array(workshopReportRowSchema) }),
        "Failed to load the workshops report",
      ).rows,
    enabled: options.enabled ?? true,
  });
}

export function useWorkshopPreferences(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: WORKSHOPS_PREFERENCES_QUERY_KEY,
    queryFn: async ({ signal }) =>
      read(
        await apiContract.workshopsCompletion.getPreferences({ fetchOptions: { signal } }),
        workshopPreferencesSchema,
        "Failed to load workshop settings",
      ),
    enabled: options.enabled ?? true,
  });
}

export const useSaveWorkshopPreferences = () =>
  useWorkshopsMutation(async (body: WorkshopPreferences) =>
    read(
      await apiContract.workshopsCompletion.savePreferences({ body }),
      workshopPreferencesSchema,
      "Failed to save workshop settings",
    ),
  );
