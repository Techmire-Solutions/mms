/**
 * @file WorkshopDetailDrawer.tsx
 * @description Workshop inspection drawer: details, participants, per-day check-in and scores.
 */

import React from "react";
import {
  formatDate,
  type AppTranslationKey,
  type WorkshopEvent,
  type WorkshopStatus,
} from "@mms/shared";
import { Button } from "@/components/ui/button";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@/components/app/DetailDrawerArchiveChrome";
import { DrawerUpdatedStamp } from "@/components/app/DrawerUpdatedStamp";
import { ErrorState } from "@/components/app/ErrorState";
import { useCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkshopDetail } from "../hooks/useWorkshopsApi";
import { formatWorkshopDates, formatWorkshopFill } from "./workshopsWorkColumns";
import { WorkshopParticipantsSection } from "./WorkshopParticipantsSection";
import { WorkshopCheckInSection } from "./WorkshopCheckInSection";
import { WorkshopScoresSection } from "./WorkshopScoresSection";
import { WorkshopCompletionSection } from "./WorkshopCompletionSection";
import { WorkshopPhaseBadge } from "./WorkshopPhaseBadge";

export interface WorkshopDetailDrawerProps {
  workshop: WorkshopEvent | null;
  canWrite: boolean;
  canManage: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: (workshop: WorkshopEvent) => void;
  onRestore: (id: string) => void;
  /** Resolves true when the transition committed (the confirmation dialog stays open otherwise). */
  onTransition: (workshop: WorkshopEvent, to: WorkshopStatus, reason?: string) => Promise<boolean>;
}

interface LifecycleAction {
  to: WorkshopStatus;
  labelKey: AppTranslationKey;
  titleKey: AppTranslationKey;
  descriptionKey: AppTranslationKey;
  destructive?: boolean;
  reason?: boolean;
}

const PUBLISH: LifecycleAction = {
  to: "open",
  labelKey: "workshops.actions.publish",
  titleKey: "workshops.transition.publishTitle",
  descriptionKey: "workshops.transition.publishDescription",
};
const UNPUBLISH: LifecycleAction = {
  to: "draft",
  labelKey: "workshops.actions.unpublish",
  titleKey: "workshops.transition.unpublishTitle",
  descriptionKey: "workshops.transition.unpublishDescription",
};
const COMPLETE: LifecycleAction = {
  to: "completed",
  labelKey: "workshops.actions.complete",
  titleKey: "workshops.transition.completeTitle",
  descriptionKey: "workshops.transition.completeDescription",
};
const CANCEL: LifecycleAction = {
  to: "cancelled",
  labelKey: "workshops.actions.cancel",
  titleKey: "workshops.transition.cancelTitle",
  descriptionKey: "workshops.transition.cancelDescription",
  destructive: true,
  reason: true,
};

/**
 * Which lifecycle actions the current state allows. The server is still the authority (it rejects
 * an illegal transition with 409); this only avoids offering actions that cannot succeed.
 */
export function lifecycleActions(workshop: WorkshopEvent, canManage = true): LifecycleAction[] {
  if (workshop.status === "draft") return [PUBLISH];
  if (workshop.status !== "open") return [];
  const actions = [
    ...(workshop.phase === "finished" ? [COMPLETE] : []),
    ...(workshop.participantCount === 0 ? [UNPUBLISH] : []),
    CANCEL,
  ];
  // Completing or cancelling is `workshops.manage`; publishing/unpublishing stays writer-level.
  return canManage ? actions : actions.filter((action) => action.to === "draft");
}

export function WorkshopDetailDrawer({
  workshop,
  canWrite,
  canManage,
  canDelete,
  onClose,
  onEdit,
  onRestore,
  onTransition,
}: WorkshopDetailDrawerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [pending, setPending] = React.useState<LifecycleAction | null>(null);
  const detailQuery = useWorkshopDetail(workshop?.id ?? null);
  if (!workshop) return null;

  const current = detailQuery.data?.workshop ?? workshop;
  const waitlistCount = detailQuery.data?.waitlistCount ?? 0;
  const isArchived = Boolean(current.deletedAt);
  const actions = isArchived ? [] : lifecycleActions(current, canManage);
  const facts: Array<[string, string]> = [
    [t("workshops.dates"), formatWorkshopDates(current)],
    [
      t("workshops.registrationDeadline"),
      current.registrationDeadline ? formatDate(current.registrationDeadline) : "—",
    ],
    [t("workshops.participants"), formatWorkshopFill(t, current)],
    [t("workshops.fee"), current.fee ? formatCurrency(current.fee) : t("workshops.free")],
  ];
  if (waitlistCount > 0) {
    facts.push([
      t("workshops.waitlist.heading"),
      t("workshops.waitlist.count", { count: waitlistCount }),
    ]);
  }

  return (
    <DetailDrawerShell
      open
      onClose={onClose}
      size="lg"
      title={current.title}
      headerActions={
        <DetailDrawerRestoreOrEditAction
          isArchived={isArchived}
          canRestore={canDelete}
          canEdit={canWrite && !isArchived}
          restoreLabel={t("workshops.restore")}
          editLabel={t("common.edit")}
          onRestore={() => onRestore(current.id)}
          onEdit={() => onEdit(current)}
        />
      }
      footer={
        <DrawerUpdatedStamp
          updatedAt={current.updatedAt}
          createdAt={current.createdAt}
          label={t("workshops.updatedLabel")}
        />
      }
    >
      <div className="space-y-6 text-start">
        {isArchived ? (
          <DetailDrawerArchivedBanner
            deletedAt={current.deletedAt}
            title={t("common.archiveTitle", { title: current.title })}
          />
        ) : null}
        {current.description ? (
          <p className="text-sm text-foreground text-wrap-pretty">{current.description}</p>
        ) : null}
        <dl className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t("workshops.status")}</dt>
            <dd>
              <WorkshopPhaseBadge phase={current.phase} />
            </dd>
          </div>
          {facts.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-end text-foreground tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {canWrite && actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.to}
                type="button"
                size="sm"
                variant={action.destructive ? "destructive" : "outline"}
                onClick={() => setPending(action)}
              >
                {t(action.labelKey)}
              </Button>
            ))}
          </div>
        ) : null}

        {detailQuery.isError ? (
          <ErrorState
            title={t("workshops.loadFailed")}
            description={t("workshops.loadFailedHint")}
            onRetry={() => void detailQuery.refetch()}
          />
        ) : detailQuery.data ? (
          <>
            <WorkshopParticipantsSection
              key={`participants-${detailQuery.data.workshop.id}`}
              detail={detailQuery.data}
              canWrite={canWrite}
              canDelete={canDelete}
            />
            <WorkshopCheckInSection
              key={`checkin-${detailQuery.data.workshop.id}`}
              detail={detailQuery.data}
              canWrite={canWrite}
            />
            <WorkshopScoresSection
              key={`scores-${detailQuery.data.workshop.id}`}
              detail={detailQuery.data}
              canWrite={canWrite}
            />
            <WorkshopCompletionSection
              key={`completion-${detailQuery.data.workshop.id}`}
              workshop={detailQuery.data.workshop}
              canWrite={canWrite}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("common.loading")}
          </p>
        )}
      </div>

      <ConfirmAlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending ? t(pending.titleKey, { title: current.title }) : ""}
        description={pending ? t(pending.descriptionKey) : ""}
        confirmLabel={pending ? t(pending.labelKey) : ""}
        destructive={pending?.destructive}
        optionalReason={
          pending?.reason
            ? {
                label: t("workshops.cancelReason"),
                placeholder: t("workshops.cancelReasonHint"),
                maxLength: 500,
              }
            : undefined
        }
        onConfirm={async (reason) => {
          if (!pending) return false;
          const committed = await onTransition(current, pending.to, reason);
          if (!committed) return false;
          setPending(null);
          return true;
        }}
      />
    </DetailDrawerShell>
  );
}
