import React from "react";
import { Printer } from "lucide-react";
import { formatDate } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@/components/app/entityCardChrome";
import { EntityCardMetaTile } from "@/components/app/EntityCardMetaTile";
import { EntityCardsGrid } from "@/components/app/EntityCardsGrid";
import { EntityCard } from "@/components/app/EntityCard";
import { DirectoryCard } from "@/components/app/DirectoryCard";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { ObligationCollectionRowActions } from "@/tenant/features/obligations/components/ObligationCollectionRowActions";
import {
  formatObligationCollectionAmount,
  getObligationCollectionResolvedFields,
  type ObligationCollectionListContentProps,
} from "@/tenant/features/obligations/lib/obligationCollectionListContentShared";

type ObligationCollectionListCardsProps = Omit<
  ObligationCollectionListContentProps,
  "search" | "typeFilter" | "onAddNew" | "getColumnWidth" | "onColumnResize"
>;

/** Work directory card — DirectoryCard SSOT (do not hand-compose EntityCard). */
function ObligationCollectionCard({
  collection,
  props,
  reducedMotion,
}: {
  collection: ObligationCollectionListCardsProps["collections"][number];
  props: ObligationCollectionListCardsProps;
  reducedMotion: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const {
    selectedIds,
    isColumnVisible,
    canWrite,
    canDelete,
    showDeleted,
    paymentModeConfig,
    getContact,
    getRep,
    getMujtahid,
    getObligationType,
    onView,
    onPrint,
    onToggleSelectedCollection,
    onTrashAction,
    onMessage,
  } = props;

  const helpers = { getContact, getRep, getMujtahid, getObligationType };
  const { sender, obligationType, rep, mujtahid } = getObligationCollectionResolvedFields(
    collection,
    helpers,
  );
  const displayName = sender?.name || "—";

  return (
    <DirectoryCard
      entity={collection}
      selectedIds={selectedIds}
      canSelect={canDelete}
      onToggleSelected={onToggleSelectedCollection}
      onView={onView}
      reducedMotion={reducedMotion}
      header={{
        displayName,
        subtitle: isColumnVisible("receiptNo") ? (
          <p className="mt-0.5 truncate font-mono text-xs font-bold text-primary">
            {collection.receipt_no}
          </p>
        ) : undefined,
      }}
      viewLabel={t("obligations.actions.viewShort")}
      viewAriaLabel={t("obligations.actions.view", { receipt: collection.receipt_no })}
      metadataSlot={
        <EntityCard.MetaGrid>
          {isColumnVisible("receivedDate") && (
            <EntityCardMetaTile label={t("obligations.columns.receivedDate")}>
              {formatDate(collection.received_date)}
            </EntityCardMetaTile>
          )}
          {isColumnVisible("obligationType") && (
            <EntityCardMetaTile label={t("obligations.columns.obligationType")}>
              <Badge pill tone="primary" className="px-2 font-bold">
                {obligationType?.name || "—"}
              </Badge>
            </EntityCardMetaTile>
          )}
          {isColumnVisible("repMujtahid") && (
            <EntityCardMetaTile label={t("obligations.columns.repMujtahid")}>
              <span>{rep?.name || "—"}</span>
              {mujtahid && (
                <span className="block text-xs text-muted-foreground">{mujtahid.name}</span>
              )}
            </EntityCardMetaTile>
          )}
          {isColumnVisible("amount") && (
            <EntityCardMetaTile label={t("obligations.columns.amount")}>
              <span className="font-semibold">{formatObligationCollectionAmount(collection)}</span>
            </EntityCardMetaTile>
          )}
          {isColumnVisible("paymentMode") && (
            <EntityCardMetaTile label={t("obligations.columns.paymentMode")}>
              <StatusBadge status={collection.payment_mode} config={paymentModeConfig} size="sm" />
            </EntityCardMetaTile>
          )}
        </EntityCard.MetaGrid>
      }
      actions={
        !showDeleted ? (
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={() => onPrint(collection)}
            aria-label={t("obligations.actions.printShort")}
            title={t("obligations.actions.printShort")}
          >
            <Printer className="w-4 h-4" />
          </Button>
        ) : null
      }
      overflowActions={
        <ObligationCollectionRowActions
          collection={collection}
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          hideViewItem
          onView={onView}
          onPrint={onPrint}
          onMessage={onMessage}
          onTrashAction={onTrashAction}
          triggerClassName={ENTITY_CARD_OVERFLOW_TRIGGER_CLASS}
        />
      }
    />
  );
}

export function ObligationCollectionsListCards(
  props: ObligationCollectionListCardsProps,
): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const {
    collections,
    selectedIds,
    canDelete,
    allVisibleSelected,
    someVisibleSelected,
    onToggleSelectAll,
  } = props;

  const pageCountLabel = formatDirectoryPageCountLabel(collections.length, t, {
    singular: "obligations.item.collection",
    plural: "obligations.item.collections",
  });

  return (
    <EntityCardsGrid
      items={collections}
      selectedIds={selectedIds}
      onSelectAll={canDelete ? () => onToggleSelectAll(!allVisibleSelected) : undefined}
      allSelected={allVisibleSelected}
      someSelected={someVisibleSelected}
      selectAllLabel={t("obligations.trash.selectAll")}
      deselectAllLabel={t("common.deselect")}
      selectedCountLabel={t("obligations.trash.selected", { count: selectedIds.length })}
      pageCountLabel={pageCountLabel}
      checkboxIdPrefix="obligations-select-cards"
      renderItem={(collection) => (
        <ObligationCollectionCard
          key={collection.id}
          collection={collection}
          props={props}
          reducedMotion={reducedMotion}
        />
      )}
    />
  );
}
