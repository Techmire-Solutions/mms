import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  enrollmentPlacementSchema,
  enrollmentRecordSchema,
  type Enrollment,
  type EnrollmentPlacement,
  type EnrollmentTransferBody,
  type EnrollmentWithdrawBody,
  type WithdrawalBillingOutcome,
  withdrawalBillingOutcomeSchema,
} from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

export const ENROLLMENT_PLACEMENTS_QUERY_KEY = ["enrollments", "placements"] as const;

const base = (id: string) => `/api/enrollments/${encodeURIComponent(id)}`;
const enrollmentEnvelope = z.object({ enrollment: enrollmentRecordSchema });
const post = async (path: string, body: unknown): Promise<Enrollment> =>
  enrollmentEnvelope.parse(
    await apiJson<unknown>(path, { method: "POST", body: JSON.stringify(body) }),
  ).enrollment;

/** Placement history (class × section over time) of one enrollment. */
export function enrollmentPlacementsQueryOptions(enrollmentId: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...ENROLLMENT_PLACEMENTS_QUERY_KEY, enrollmentId] as const,
    queryFn: async ({ signal }): Promise<EnrollmentPlacement[]> =>
      z
        .object({ placements: z.array(enrollmentPlacementSchema) })
        .parse(await apiJson<unknown>(`${base(enrollmentId)}/placements`, { signal })).placements,
    enabled: enabled && Boolean(enrollmentId),
    staleTime: 30_000,
  });
}

export function transferEnrollmentMutationOptions() {
  return mutationOptions({
    mutationKey: ["enrollments", "transfer"] as const,
    mutationFn: ({ id, body }: { id: string; body: EnrollmentTransferBody }) =>
      post(`${base(id)}/transfer`, body),
  });
}

export function withdrawEnrollmentMutationOptions() {
  return mutationOptions({
    mutationKey: ["enrollments", "withdraw"] as const,
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: EnrollmentWithdrawBody;
    }): Promise<{ enrollment: Enrollment; billing: WithdrawalBillingOutcome }> =>
      z
        .object({ enrollment: enrollmentRecordSchema, billing: withdrawalBillingOutcomeSchema })
        .parse(
          await apiJson<unknown>(`${base(id)}/withdraw`, {
            method: "POST",
            body: JSON.stringify(body),
          }),
        ),
  });
}
