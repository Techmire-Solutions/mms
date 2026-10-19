import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AppTranslationKey,
  SectionCloseBody,
  SectionMergeBody,
  SectionOperationResult,
  SectionSplitBody,
} from "@mms/shared";
import { isApiError } from "@/lib/apiError";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import {
  closeSectionMutationOptions,
  mergeSectionMutationOptions,
  splitSectionMutationOptions,
} from "@/lib/query/sectionOperationsQueries";
import { invalidateEnrollmentsQueries } from "@/tenant/hooks/collections/enrollments";
import { invalidateSessionsQueries } from "./invalidateSessionsQueries";

/** Merge / split / close with call-site toasts; each resolves the result, or null on failure. */
export function useSectionOperations() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const onSettled = () => {
    invalidateSessionsQueries(queryClient);
    invalidateEnrollmentsQueries(queryClient);
  };
  const mergeMutation = useMutation({ ...mergeSectionMutationOptions(), onSettled });
  const splitMutation = useMutation({ ...splitSectionMutationOptions(), onSettled });
  const closeMutation = useMutation({ ...closeSectionMutationOptions(), onSettled });

  const run = async <B>(
    mutate: (input: { sectionId: string; body: B }) => Promise<SectionOperationResult>,
    sectionId: string,
    body: B,
    keys: { ok: AppTranslationKey; failed: AppTranslationKey },
  ): Promise<SectionOperationResult | null> => {
    try {
      const result = await mutate({ sectionId, body });
      notify.success(t(keys.ok, { count: result.moved }));
      return result;
    } catch (error) {
      notify.error(t(keys.failed), {
        description: isApiError(error) && error.status < 500 ? error.message : undefined,
      });
      return null;
    }
  };

  return {
    merge: (sectionId: string, body: SectionMergeBody) =>
      run(mergeMutation.mutateAsync, sectionId, body, {
        ok: "sessions.sections.ops.merged",
        failed: "sessions.sections.ops.mergeFailed",
      }),
    split: (sectionId: string, body: SectionSplitBody) =>
      run(splitMutation.mutateAsync, sectionId, body, {
        ok: "sessions.sections.ops.split",
        failed: "sessions.sections.ops.splitFailed",
      }),
    close: (sectionId: string, body: SectionCloseBody) =>
      run(closeMutation.mutateAsync, sectionId, body, {
        ok: "sessions.sections.ops.closed",
        failed: "sessions.sections.ops.closeFailed",
      }),
    isPending: mergeMutation.isPending || splitMutation.isPending || closeMutation.isPending,
  };
}
