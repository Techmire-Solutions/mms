import React from "react";
import { Printer, Receipt } from "lucide-react";
import { formatDate } from "@mms/contracts";
import { Button } from "@mms/ui";
import { useReducedMotion } from "@mms/fe-core/tenant";
import { useTranslation } from "@mms/fe-core/i18n";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@mms/ui/app/entityCardChrome";
import { DirectoryCardMetaTile } from "@mms/ui/app/DirectoryCardMetaTile";
import { ModuleDirectoryCards } from "@mms/fe-core/components/ModuleDirectoryCards";
import { EntityCard } from "@mms/fe-core/components/EntityCard";
import { DirectoryEntityCard } from "@mms/fe-core/components/DirectoryEntityCard";
import { StatusBadge } from "@mms/fe-core/components/StatusBadge";
import { Badge } from "@mms/ui";
import { formatDirectoryPageCountLabel } from "@mms/fe-core/tenant/formatDirectoryPageCountLabel";
import { ObligationCollectionRowActions } from "./ObligationCollectionRowActions";
import {
  formatObligationCollectionAmount,
  getObligationCollectionResolvedFields,
  type ObligationCollectionListContentProps,
} from "../lib/obligationCollectionListContentShared";

type ObligationCollectionListCardsProps = Omit<
  ObligationCollectionListContentProps,
  "search" | "typeFilter" | "onAddNew" | "getColumnWidth" | "onColumnResize"
>;

/** Work directory card — DirectoryEntityCard SSOT (do not hand-compose EntityCard). */
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
    onViewVoucher,
  } = props;

  const helpers = { getContact, getRep, getMujtahid, getObligationType };
  const { sender, obligationType, rep, mujtahid } = getObligationCollectionResolvedFields(
    collection,
    helpers,
  );
  const displayName = sender?.name || "—";

  return (
    <DirectoryEntityCard
      entity={collection}
      selectedIds={selectedIds}
      canSelect={canDelete}
      onToggleSelected={onToggleSelectedCollection}
      onView={onView}
      reducedMotion={reducedMotion}
      header={{
        displayName,
        subtitle: isColumnVisible("receiptNo") ? (
          onViewVoucher ? (
            <button
              type="button"
              onClick={(e: any) => {
                e.stopPropagation();
                onViewVoucher(collection);
              }}
              className="mt-0.5 inline-flex items-center gap-1 truncate font-mono text-xs font-bold text-primary hover:underline group"
              title={t("obligations.actions.viewVoucher")}
            >
              <span>{collection.receipt_no}</span>
              <Receipt
                className="w-3 h-3 opacity-70 group-hover:opacity-100 text-muted-foreground group-hover:text-primary transition-opacity"
                aria-hidden="true"
              />
            </button>
          ) : (
            <p className="mt-0.5 truncate font-mono text-xs font-bold text-primary">
              {collection.receipt_no}
            </p>
          )
        ) : undefined,
      }}
      viewLabel={t("obligations.actions.viewShort")}
      viewAriaLabel={t("obligations.actions.view", { receipt: collection.receipt_no })}
      metadataSlot={
        <EntityCard.MetaGrid>
          {isColumnVisible("receivedDate") && (
            <DirectoryCardMetaTile label={t("obligations.columns.receivedDate")}>
              {formatDate(collection.received_date)}
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("obligationType") && (
            <DirectoryCardMetaTile label={t("obligations.columns.obligationType")}>
              <Badge pill tone="primary" className="px-2 font-bold">
                {obligationType?.name || "—"}
              </Badge>
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("repMujtahid") && (
            <DirectoryCardMetaTile label={t("obligations.columns.repMujtahid")}>
              <span>{rep?.name || "—"}</span>
              {mujtahid && (
                <span className="block text-xs text-muted-foreground">{mujtahid.name}</span>
              )}
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("amount") && (
            <DirectoryCardMetaTile label={t("obligations.columns.amount")}>
              <span className="font-semibold">{formatObligationCollectionAmount(collection)}</span>
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("paymentMode") && (
            <DirectoryCardMetaTile label={t("obligations.columns.paymentMode")}>
              <StatusBadge status={collection.payment_mode} config={paymentModeConfig} size="sm" />
            </DirectoryCardMetaTile>
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
          onViewVoucher={onViewVoucher}
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
    <ModuleDirectoryCards
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
      renderItem={(collection: any) => (
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
