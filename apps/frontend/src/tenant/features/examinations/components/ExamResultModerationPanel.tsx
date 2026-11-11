import React, { useState } from "react";
import { Scale } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { EXAMINATIONS_MODULE_MANIFEST } from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { invalidateExaminationsQueries } from "@/tenant/features/examinations/hooks/invalidateExaminationsQueries";
import { notify } from "@/lib/notify";
import type { Exam } from "@/lib/data/examinationData";
import type { StudentResultItem } from "@/tenant/features/examinations/components/StudentResultCard";

/**
 * Audited grace-mark panel on a single result.
 *
 * The raw mark is never edited: the adjustment is stored beside it with the reason and the
 * moderator, and the server refuses once results are published. This component decides nothing
 * about permissions or scoring — it collects the adjustment and the reason.
 */
export function ExamResultModerationPanel({
  exam,
  result,
  onSaved,
}: {
  exam: Exam;
  result: StudentResultItem;
  onSaved: () => void;
}): React.JSX.Element | null {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Moderation shares the publish/unlock authority, so the panel follows `delete`, not `write`.
  const { canDelete } = useModulePermissions(EXAMINATIONS_MODULE_MANIFEST);
  const [graceValue, setGraceValue] = useState(
    result.graceMarks && result.graceMarks > 0 ? String(result.graceMarks) : "",
  );
  const [graceReason, setGraceReason] = useState(result.moderationReason ?? "");

  const isPublished = Boolean(exam.resultsFinalizedAt);
  const canModerate = canDelete && !isPublished && Boolean(result.studentId);

  const moderate = tsrClient.examinations.moderateExamResult.useMutation({
    onSuccess: () => {
      notify.success(t("examinations.resultCard.graceSaved"));
      void invalidateExaminationsQueries(queryClient);
      onSaved();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const graceMarks = Number(graceValue || 0);
  const effectivePreview = result.marksObtained + (Number.isFinite(graceMarks) ? graceMarks : 0);

  if (!canModerate) return null;

  const canApply =
    !moderate.isPending &&
    graceReason.trim().length >= 3 &&
    Number.isFinite(graceMarks) &&
    graceMarks >= 0 &&
    effectivePreview <= exam.totalMarks;

  return (
    <section
      className="space-y-2 rounded-xl border border-border bg-muted/20 p-4"
      aria-labelledby="exam-grace-title"
    >
      <p
        id="exam-grace-title"
        className="m-0 flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <Scale className="h-4 w-4" aria-hidden="true" />
        {t("examinations.resultCard.graceTitle")}
      </p>
      <p className="m-0 text-xs text-muted-foreground">
        {t("examinations.resultCard.graceHelp", {
          raw: String(result.marksObtained),
          effective: String(effectivePreview),
          total: String(exam.totalMarks),
        })}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-24">
          <label
            htmlFor="exam-grace-marks"
            className="mb-1 block text-xs font-medium text-foreground"
          >
            {t("examinations.resultCard.graceMarks")}
          </label>
          <Input
            id="exam-grace-marks"
            name="graceMarks"
            inputMode="decimal"
            value={graceValue}
            onChange={(event) => setGraceValue(event.target.value)}
            maxLength={8}
          />
        </div>
        <div className="min-w-40 flex-1">
          <label
            htmlFor="exam-grace-reason"
            className="mb-1 block text-xs font-medium text-foreground"
          >
            {t("examinations.resultCard.graceReason")}
          </label>
          <Input
            id="exam-grace-reason"
            name="graceReason"
            value={graceReason}
            onChange={(event) => setGraceReason(event.target.value)}
            maxLength={500}
          />
        </div>
        <Button
          type="button"
          disabled={!canApply}
          onClick={() =>
            moderate.mutate({
              params: { id: exam.id, studentId: String(result.studentId ?? "") },
              body: {
                graceMarks,
                reason: graceReason.trim(),
                ...(typeof result.version === "number" ? { version: result.version } : {}),
              },
            })
          }
        >
          {t("examinations.resultCard.graceApply")}
        </Button>
      </div>
    </section>
  );
}
