import { useState } from "react";
import { todayISO, type FxRevaluationRun } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  useFxRevaluationRuns,
  usePostFxRevaluation,
  usePreviewFxRevaluation,
} from "@/tenant/features/accounting/hooks/useFxRevaluation";

/** State and actions for Setup → Period-end FX revaluation (preview, post, history). */
export function useFxRevaluationPanel() {
  const { t } = useTranslation();
  const runs = useFxRevaluationRuns();
  const preview = usePreviewFxRevaluation();
  const post = usePostFxRevaluation();
  const [revaluationDate, setRevaluationDate] = useState(todayISO());
  const [previewRun, setPreviewRun] = useState<FxRevaluationRun | null>(null);

  const alreadyPosted = (runs.data ?? []).some((run) => run.revaluationDate === revaluationDate);

  const handlePreview = async (): Promise<void> => {
    try {
      setPreviewRun(await preview.mutateAsync(revaluationDate));
    } catch (error) {
      setPreviewRun(null);
      notify.error(t("accounting.settings.fxReval.previewFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handlePost = async (): Promise<void> => {
    try {
      const run = await post.mutateAsync(revaluationDate);
      setPreviewRun(null);
      notify.success(t("accounting.settings.fxReval.posted", { amount: run.totalUnrealized }));
    } catch (error) {
      notify.error(t("accounting.settings.fxReval.postFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    revaluationDate,
    setRevaluationDate: (date: string) => {
      setRevaluationDate(date);
      setPreviewRun(null);
    },
    previewRun,
    runs: runs.data ?? [],
    runsLoading: runs.isPending,
    runsError: runs.isError,
    refetchRuns: runs.refetch,
    alreadyPosted,
    previewing: preview.isPending,
    posting: post.isPending,
    handlePreview,
    handlePost,
  };
}
