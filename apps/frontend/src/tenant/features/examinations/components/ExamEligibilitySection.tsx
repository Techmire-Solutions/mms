import React from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { tsrClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

/**
 * Exam attendance gate: who may sit the exam, and the finalisation stamp completion depends on.
 *
 * Read-only by design in the drawer — the threshold and overrides are administrative actions and
 * stay on their endpoints; teaching staff see why a student is blocked before entering marks.
 */
export function ExamEligibilitySection({
  examId,
  canManage,
}: {
  examId: string;
  canManage: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const query = tsrClient.examinations.getExamEligibility.useQuery({
    queryKey: ["examinations", "eligibility", examId],
    params: { id: examId },
    query: undefined,
  });

  const finalize = tsrClient.examinations.setExamResultsFinalized.useMutation({
    onSuccess: () => {
      void query.refetch();
      notify.success(t("examinations.eligibility.finalized"));
    },
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
          {canManage && (
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
        </div>
      )}
    </DetailSectionCard>
  );
}
