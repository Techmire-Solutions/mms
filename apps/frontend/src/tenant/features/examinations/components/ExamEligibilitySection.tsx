import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, Lock, Unlock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { tsrClient } from "@/lib/api";
import { invalidateExaminationsQueries } from "../hooks/invalidateExaminationsQueries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { FORM_INPUT_COMPACT } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

/**
 * Exam attendance gate: who may sit the exam, and the publication stamp completion depends on.
 *
 * Read-only by design in the drawer — the threshold and overrides are administrative actions and
 * stay on their endpoints; teaching staff see why a student is blocked before entering marks.
 *
 * Publication is a lifecycle transition, not a checkbox: publishing asks the backend to validate
 * (marks exist, exam not cancelled, not already published) and re-opening is the explicit
 * administrative unlock, which requires a reason.
 */
export function ExamEligibilitySection({
  examId,
  canManage,
  resultsFinalizedAt,
}: {
  examId: string;
  canManage: boolean;
  /** Publication stamp from the exam record; `null`/absent means marks are still editable. */
  resultsFinalizedAt?: string | null;
}): React.JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  const isPublished = Boolean(resultsFinalizedAt);

  const query = tsrClient.examinations.getExamEligibility.useQuery({
    queryKey: ["examinations", "eligibility", examId],
    params: { id: examId },
    query: undefined,
  });

  const finalize = tsrClient.examinations.setExamResultsFinalized.useMutation({
    onSuccess: () => {
      setReopening(false);
      setReason("");
      // Publishing/ unlocking changes the exam lock, marks visibility, metrics and analytics.
      void invalidateExaminationsQueries(queryClient);
      void query.refetch();
      notify.success(t("examinations.eligibility.finalized"));
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const body = query.data?.body as
    | {
        requiredPct: number | null;
        students: Array<{
          studentId: string;
          studentName: string;
          state: "eligible" | "blocked" | "unknown";
          attendancePct: number | null;
          overridden: boolean;
        }>;
      }
    | undefined;

  const students = body?.students ?? [];
  const blocked = students.filter((student) => student.state === "blocked");
  const unknown = students.filter((student) => student.state === "unknown");
  const reasonIsValid = reason.trim().length >= 3;

  return (
    <DetailSectionCard title={t("examinations.eligibility.title")} className="p-4">
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : query.error || !body ? (
        <p className="text-sm text-destructive">{t("examinations.eligibility.loadFailed")}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {body.requiredPct === null
              ? t("examinations.eligibility.noGate")
              : t("examinations.eligibility.required", { pct: String(body.requiredPct) })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge pill tone="success">
              <ShieldCheck className="me-1 h-3 w-3" aria-hidden="true" />
              {t("examinations.eligibility.eligibleCount", {
                count: String(students.length - blocked.length - unknown.length),
              })}
            </Badge>
            {blocked.length > 0 && (
              <Badge pill tone="destructive">
                <ShieldAlert className="me-1 h-3 w-3" aria-hidden="true" />
                {t("examinations.eligibility.blockedCount", { count: String(blocked.length) })}
              </Badge>
            )}
            {unknown.length > 0 && (
              <Badge pill tone="warning">
                {t("examinations.eligibility.unknownCount", { count: String(unknown.length) })}
              </Badge>
            )}
            {isPublished && (
              <Badge pill tone="info">
                <Lock className="me-1 h-3 w-3" aria-hidden="true" />
                {t("examinations.eligibility.published")}
              </Badge>
            )}
          </div>
          {blocked.length > 0 && (
            <ul className="space-y-1 text-sm">
              {blocked.slice(0, 8).map((student) => (
                <li key={student.studentId} className="flex justify-between gap-3">
                  <span className="truncate">{student.studentName || student.studentId}</span>
                  <span className="text-destructive">
                    {student.attendancePct ?? "?"}% / {body.requiredPct ?? "?"}%
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canManage && !isPublished && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={finalize.isPending}
              onClick={() => finalize.mutate({ params: { id: examId }, body: { finalized: true } })}
            >
              {t("examinations.eligibility.finalize")}
            </Button>
          )}
          {canManage && isPublished && !reopening && (
            <Button type="button" size="sm" variant="outline" onClick={() => setReopening(true)}>
              <Unlock className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("examinations.eligibility.unpublish")}
            </Button>
          )}
          {canManage && isPublished && reopening && (
            <div className="space-y-2">
              <label
                htmlFor="exam-unpublish-reason"
                className="block text-sm font-medium text-foreground"
              >
                {t("examinations.eligibility.unpublishReason")}
              </label>
              <Input
                id="exam-unpublish-reason"
                name="unpublishReason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t("examinations.eligibility.unpublishReasonPlaceholder")}
                className={cn(FORM_INPUT_COMPACT, "w-full")}
                maxLength={500}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!reasonIsValid || finalize.isPending}
                  onClick={() =>
                    finalize.mutate({
                      params: { id: examId },
                      body: { finalized: false, reason: reason.trim() },
                    })
                  }
                >
                  {t("examinations.eligibility.unpublishConfirm")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setReopening(false);
                    setReason("");
                  }}
                >
                  {t("examinations.eligibility.unpublishCancel")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </DetailSectionCard>
  );
}
