import { mutationOptions } from "@tanstack/react-query";
import {
  sectionOperationResultSchema,
  type SectionCloseBody,
  type SectionMergeBody,
  type SectionOperationResult,
  type SectionSplitBody,
} from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

const post = async (
  sectionId: string,
  action: "merge" | "split" | "close",
  body: unknown,
): Promise<SectionOperationResult> =>
  sectionOperationResultSchema.parse(
    await apiJson<unknown>(`/api/sessions/sections/${encodeURIComponent(sectionId)}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

export function mergeSectionMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "sections", "merge"] as const,
    mutationFn: ({ sectionId, body }: { sectionId: string; body: SectionMergeBody }) =>
      post(sectionId, "merge", body),
  });
}

export function splitSectionMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "sections", "split"] as const,
    mutationFn: ({ sectionId, body }: { sectionId: string; body: SectionSplitBody }) =>
      post(sectionId, "split", body),
  });
}

export function closeSectionMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "sections", "close"] as const,
    mutationFn: ({ sectionId, body }: { sectionId: string; body: SectionCloseBody }) =>
      post(sectionId, "close", body),
  });
}
