import React from "react";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@mms/ui/app/entityCardChrome";
import { DirectoryCardMetaTile } from "@mms/ui/app/DirectoryCardMetaTile";
import { ModuleDirectoryCards } from "@mms/fe-core/components/ModuleDirectoryCards";
import { EntityCard } from "@mms/fe-core/components/EntityCard";
import { DirectoryEntityCard } from "@mms/fe-core/components/DirectoryEntityCard";
import { StatusBadge } from "@mms/fe-core/components/StatusBadge";
import { useReducedMotion } from "@mms/fe-core/tenant";
import { useTranslation } from "@mms/fe-core/i18n";
import { formatDirectoryPageCountLabel } from "@mms/fe-core/tenant/formatDirectoryPageCountLabel";
import { DistributionsRowActions } from "./DistributionsRowActions.js";
import {
  getDistributionDenomination,
  getDistributionStatuses,
  type DistributionsListContentProps,
} from "../lib/distributionsListShared";

type DistributionsListCardsProps = Omit<
  DistributionsListContentProps,
  "getColumnWidth" | "onColumnResize"
>;

/** Work directory card — DirectoryEntityCard SSOT (do not hand-compose EntityCard). */
function DistributionCard({
  distribution,
  props,
  denomsById,
  reducedMotion,
}: {
  distribution: DistributionsListCardsProps["distributions"][number];
  props: DistributionsListCardsProps;
  denomsById: Map<string, DistributionsListCardsProps["denoms"][number]>;
  reducedMotion: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const {
    selectedIds,
    isColumnVisible,
    statusLabels,
    statusConfig,
    canWrite,
    canDelete,
    showDeleted,
    canRestoreRows,
    canDeleteRows,
    onMessage,
    onChangeStatus,
    onToggleSelectedDistribution,
    onTrashAction,
  } = props;

  const statuses = getDistributionStatuses(statusConfig);
  const denomination = getDistributionDenomination(denomsById, distribution.denominationId);
  const displayName = distribution.recipientName || distribution.id;

  return (
    <DirectoryEntityCard
      entity={distribution}
      selectedIds={selectedIds}
      canSelect={canDelete}
      onToggleSelected={onToggleSelectedDistribution}
      reducedMotion={reducedMotion}
      header={{
        displayName,
        subtitle:
          isColumnVisible("card") && denomination ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <span aria-hidden="true">{denomination.icon || "⭐"}</span>
              <span className="truncate">{distribution.denominationName}</span>
              {/* denomination.color is a tenant-configurable brand hex — inline style is the established MMS pattern */}
              <span className="font-bold" style={{ color: denomination.color }}>
                {t("hasanat.form.pointsShort", { points: denomination.points })}
              </span>
            </p>
          ) : undefined,
      }}
      metadataSlot={
        <EntityCard.MetaGrid>
          {isColumnVisible("recipientClass") && (
            <DirectoryCardMetaTile label={t("hasanat.columns.distribution.recipientClass")}>
              {distribution.recipientClass || "—"}
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("quantity") && (
            <DirectoryCardMetaTile label={t("hasanat.columns.distribution.quantity")}>
              <span className="font-bold">{distribution.quantity}</span>
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("reason") && (
            <DirectoryCardMetaTile label={t("hasanat.columns.distribution.reason")}>
              <span className="break-words">{distribution.reason || "—"}</span>
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("issuedDate") && (
            <DirectoryCardMetaTile label={t("hasanat.columns.distribution.issuedDate")}>
              {distribution.issuedDate}
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("issuedBy") && (
            <DirectoryCardMetaTile label={t("hasanat.columns.distribution.issuedBy")}>
              <span className="break-words">{distribution.issuedBy || "—"}</span>
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("status") && (
            <DirectoryCardMetaTile label={t("hasanat.columns.distribution.status")}>
              <StatusBadge status={distribution.status} config={statusConfig} size="sm" />
            </DirectoryCardMetaTile>
          )}
        </EntityCard.MetaGrid>
      }
      overflowActions={
        <DistributionsRowActions
          distribution={distribution}
          statuses={statuses}
          statusLabels={statusLabels}
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          canRestoreRows={canRestoreRows}
          canDeleteRows={canDeleteRows}
          triggerClassName={ENTITY_CARD_OVERFLOW_TRIGGER_CLASS}
          onMessage={onMessage ? (channel, dist) => onMessage(channel, [dist]) : undefined}
          onChangeStatus={onChangeStatus}
          onTrashAction={onTrashAction}
        />
      }
    />
  );
}

export function DistributionsListCards(props: DistributionsListCardsProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const {
    distributions,
    denoms,
    selectedIds,
    allVisibleSelected,
    someVisibleSelected,
    canDelete,
    onToggleSelectAll,
  } = props;

  const pageCountLabel = formatDirectoryPageCountLabel(distributions.length, t, {
    singular: "hasanat.item.distribution",
    plural: "hasanat.item.distributions",
  });

  const denomsById = new Map<string, (typeof denoms)[number]>();
  for (const d of denoms) {
    denomsById.set(d.id, d);
  }

  return (
    <ModuleDirectoryCards
      items={distributions}
      selectedIds={selectedIds}
      onSelectAll={canDelete ? () => onToggleSelectAll(!allVisibleSelected) : undefined}
      allSelected={allVisibleSelected}
      someSelected={someVisibleSelected}
      selectAllLabel={t("hasanat.trash.selectAll")}
      deselectAllLabel={t("common.deselect")}
      selectedCountLabel={t("hasanat.trash.selected", { count: selectedIds.length })}
      pageCountLabel={pageCountLabel}
      checkboxIdPrefix="hasanat-select-cards"
      renderItem={(distribution) => (
        <DistributionCard
          key={distribution.id}
          distribution={distribution}
          props={props}
          denomsById={denomsById}
          reducedMotion={reducedMotion}
        />
      )}
    />
  );
}
