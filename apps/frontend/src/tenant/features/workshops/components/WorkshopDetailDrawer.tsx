/**
 * @file WorkshopDetailDrawer.tsx
 * @description Workshop inspection drawer: details, participants, per-day check-in and scores.
 */

import React from "react";
import { formatDate, type WorkshopEvent } from "@mms/shared";
import { Drawer } from "@/components/app/Drawer";
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

export interface WorkshopDetailDrawerProps {
  workshop: WorkshopEvent | null;
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: (workshop: WorkshopEvent) => void;
  onRestore: (id: string) => void;
}

export function WorkshopDetailDrawer({
  workshop,
  canWrite,
  canDelete,
  onClose,
  onEdit,
  onRestore,
}: WorkshopDetailDrawerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const detailQuery = useWorkshopDetail(workshop?.id ?? null);
  if (!workshop) return null;

  const current = detailQuery.data?.workshop ?? workshop;
  const isArchived = Boolean(current.deletedAt);
  const facts: Array<[string, string]> = [
    [t("workshops.dates"), formatWorkshopDates(current)],
    [
      t("workshops.registrationDeadline"),
      current.registrationDeadline ? formatDate(current.registrationDeadline) : "—",
    ],
    [t("workshops.participants"), formatWorkshopFill(t, current)],
    [t("workshops.fee"), current.fee ? formatCurrency(current.fee) : t("workshops.free")],
  ];

  return (
    <Drawer
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
          {facts.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-end text-foreground tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {detailQuery.isError ? (
          <ErrorState
            title={t("workshops.loadFailed")}
            description={t("workshops.loadFailedHint")}
            onRetry={() => void detailQuery.refetch()}
          />
        ) : detailQuery.data ? (
          <>
            <WorkshopParticipantsSection
              detail={detailQuery.data}
              canWrite={canWrite}
              canDelete={canDelete}
            />
            <WorkshopCheckInSection detail={detailQuery.data} canWrite={canWrite} />
            <WorkshopScoresSection detail={detailQuery.data} canWrite={canWrite} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("common.loading")}
          </p>
        )}
      </div>
    </Drawer>
  );
}
