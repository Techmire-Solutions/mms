import React, { useState } from "react";
import {
  ArrowRightLeft,
  History,
  LogOut,
  PauseCircle,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
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

/** Placement history + Transfer / Withdraw / Suspend / Re-admit actions (Phase 9 operations). */
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
  const { transfer, withdraw, readmit, suspend, isPending } = useEnrollmentOperations();

  const canOperate =
    canWrite &&
    !isArchived &&
    enrollmentHoldsSeat(enrollment.status) &&
    enrollment.status !== "completed";
  const canReadmit = canWrite && !isArchived && enrollment.status === "withdrawn";
  const actions: {
    kind: EnrollmentOperationKind;
    label: string;
    icon: LucideIcon;
    danger?: boolean;
  }[] = canOperate
    ? [
        { kind: "transfer", label: t("enrollments.ops.transfer"), icon: ArrowRightLeft },
        { kind: "suspend", label: t("enrollments.ops.suspend"), icon: PauseCircle },
        { kind: "withdraw", label: t("enrollments.ops.withdraw"), icon: LogOut, danger: true },
      ]
    : canReadmit
      ? [{ kind: "readmit", label: t("enrollments.ops.readmit"), icon: RotateCcw }]
      : [];
  const classes = session?.classes ?? [];
  const placementLabel = (classId: string, sectionId: string | null) => {
    const cls = classes.find((row) => row.id === classId);
    const section = cls?.sections?.find((row) => row.id === sectionId);
    return [cls?.name ?? classId, section?.name].filter(Boolean).join(" · ");
  };

  if (actions.length === 0 && placements.length < 2 && !enrollment.endOn) return null;

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
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map(({ kind: action, label, icon: Icon, danger }) => (
            <Button
              key={action}
              type="button"
              variant="outline"
              size="sm"
              className={danger ? "min-h-11 gap-1.5 text-destructive" : "min-h-11 gap-1.5"}
              disabled={isPending}
              onClick={() => setKind(action)}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Button>
          ))}
        </div>
      ) : null}
      {actions.length > 0 ? (
        <EnrollmentOperationModal
          kind={kind}
          enrollment={enrollment}
          session={session}
          isPending={isPending}
          onClose={() => setKind(null)}
          onTransfer={(body) => transfer(enrollment.id, body)}
          onWithdraw={(body) => withdraw(enrollment.id, body)}
          onReadmit={(body) => readmit(enrollment.id, body)}
          onSuspend={(body) => suspend(enrollment.id, body)}
        />
      ) : null}
    </DetailSectionCard>
  );
}
