import React, { useState } from "react";
import { ArrowRightLeft, History, LogOut } from "lucide-react";
import { enrollmentHoldsSeat, formatDate, type Enrollment } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { useSessionDetail, useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import {
  useEnrollmentOperations,
  useEnrollmentPlacements,
} from "@/tenant/features/enrollments/hooks/useEnrollmentOperations";
import { EnrollmentOperationModal, type EnrollmentOperationKind } from "./EnrollmentOperationModal";

export interface EnrollmentOperationsPanelProps {
  enrollment: Enrollment;
  canWrite: boolean;
  isArchived: boolean;
}

/** Placement history + Transfer / Withdraw actions for one enrollment (Phase 9 operations). */
export function EnrollmentOperationsPanel({
  enrollment,
  canWrite,
  isArchived,
}: EnrollmentOperationsPanelProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [kind, setKind] = useState<EnrollmentOperationKind | null>(null);
  const sessions = useSessionsCollection();
  const summary = sessions.find((row) => String(row.id) === enrollment.sessionId) ?? null;
  const session = useSessionDetail(summary);
  const placements = useEnrollmentPlacements(enrollment.id).data ?? [];
  const { transfer, withdraw, isPending } = useEnrollmentOperations();

  const canOperate =
    canWrite &&
    !isArchived &&
    enrollmentHoldsSeat(enrollment.status) &&
    enrollment.status !== "completed";
  const classes = session?.classes ?? [];
  const placementLabel = (classId: string, sectionId: string | null) => {
    const cls = classes.find((row) => row.id === classId);
    const section = cls?.sections?.find((row) => row.id === sectionId);
    return [cls?.name ?? classId, section?.name].filter(Boolean).join(" · ");
  };

  if (!canOperate && placements.length < 2 && !enrollment.endOn) return null;

  return (
    <DetailSectionCard title={t("enrollments.ops.title")} className="space-y-3 p-3">
      {enrollment.endOn ? (
        <p className="text-xs text-muted-foreground" role="note">
          {t("enrollments.ops.endedOn", { date: formatDate(enrollment.endOn) })}
          {enrollment.endReason ? ` — ${enrollment.endReason}` : ""}
        </p>
      ) : null}
      {placements.length > 1 ? (
        <section aria-label={t("enrollments.ops.history")} className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <History className="size-3.5" aria-hidden />
            {t("enrollments.ops.history")}
          </p>
          <ol className="space-y-1">
            {placements.map((placement) => (
              <li key={placement.id} className="flex flex-wrap justify-between gap-2 text-xs">
                <span className="font-medium">
                  {placementLabel(placement.classId, placement.sectionId)}
                </span>
                <span className="text-muted-foreground">
                  {placement.endOn
                    ? t("enrollments.ops.range", {
                        from: formatDate(placement.startOn),
                        to: formatDate(placement.endOn),
                      })
                    : t("enrollments.ops.since", { date: formatDate(placement.startOn) })}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {canOperate ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5"
            disabled={isPending}
            onClick={() => setKind("transfer")}
          >
            <ArrowRightLeft className="size-4" aria-hidden />
            {t("enrollments.ops.transfer")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5 text-destructive"
            disabled={isPending}
            onClick={() => setKind("withdraw")}
          >
            <LogOut className="size-4" aria-hidden />
            {t("enrollments.ops.withdraw")}
          </Button>
        </div>
      ) : null}
      {canOperate ? (
        <EnrollmentOperationModal
          kind={kind}
          enrollment={enrollment}
          session={session}
          isPending={isPending}
          onClose={() => setKind(null)}
          onTransfer={(body) => transfer(enrollment.id, body)}
          onWithdraw={(body) => withdraw(enrollment.id, body)}
        />
      ) : null}
    </DetailSectionCard>
  );
}
