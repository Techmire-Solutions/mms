import React from "react";
import { formatDate } from "@mms/shared";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Badge } from "@/components/ui/badge";
import type { WorkBatchTableColumn } from "@/components/common/work";
import type { ObligationCollection } from "@/lib/data/obligationsData";
import {
  formatObligationCollectionAmount,
  getObligationCollectionResolvedFields,
  OBLIGATION_COLLECTION_CURRENCIES,
  type ObligationCollectionListContentProps,
} from "@/tenant/features/obligations/lib/obligationCollectionListContentShared";
import { Receipt } from "lucide-react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface UseObligationCollectionTableColumnsOptions {
  isColumnVisible: (key: string) => boolean;
  paymentModeConfig: ObligationCollectionListContentProps["paymentModeConfig"];
  getContact: ObligationCollectionListContentProps["getContact"];
  getRep: ObligationCollectionListContentProps["getRep"];
  getMujtahid: ObligationCollectionListContentProps["getMujtahid"];
  getObligationType: ObligationCollectionListContentProps["getObligationType"];
  userMap?: Map<string, string>;
  onViewVoucher?: (collection: ObligationCollection) => void;
  t: TranslationFunction;
}

export function useObligationCollectionTableColumns(
  options: UseObligationCollectionTableColumnsOptions,
): WorkBatchTableColumn<ObligationCollection>[] {
  const {
    isColumnVisible,
    paymentModeConfig,
    getContact,
    getRep,
    getMujtahid,
    getObligationType,
    userMap,
    onViewVoucher,
    t,
  } = options;

  const helpers = React.useMemo(
    () => ({ getContact, getRep, getMujtahid, getObligationType }),
    [getContact, getRep, getMujtahid, getObligationType],
  );

  return React.useMemo<WorkBatchTableColumn<ObligationCollection>[]>(() => {
    const cols: WorkBatchTableColumn<ObligationCollection>[] = [];

    if (isColumnVisible("receiptNo")) {
      cols.push({
        id: "receiptNo",
        label: t("obligations.columns.receiptNo"),
        noWrap: true,
        render: (collection) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewVoucher?.(collection);
            }}
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-primary hover:underline hover:text-primary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1 py-0.5 -mx-1 -my-0.5 group"
            title={t("obligations.actions.viewVoucher")}
          >
            <span>{collection.receipt_no}</span>
            <Receipt
              className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 text-muted-foreground group-hover:text-primary transition-opacity"
              aria-hidden="true"
            />
          </button>
        ),
      });
    }

    if (isColumnVisible("receivedDate")) {
      cols.push({
        id: "receivedDate",
        label: t("obligations.columns.receivedDate"),
        noWrap: true,
        cellClassName: "text-xs text-muted-foreground",
        render: (collection) => formatDate(collection.received_date),
      });
    }

    if (isColumnVisible("sender")) {
      cols.push({
        id: "sender",
        label: t("obligations.columns.sender"),
        cellClassName: "font-semibold text-foreground",
        render: (collection) => {
          const { sender } = getObligationCollectionResolvedFields(collection, helpers);
          return sender?.name || "—";
        },
      });
    }

    if (isColumnVisible("obligationType")) {
      cols.push({
        id: "obligationType",
        label: t("obligations.columns.obligationType"),
        noWrap: true,
        render: (collection) => {
          const { obligationType } = getObligationCollectionResolvedFields(collection, helpers);
          return (
            <Badge as="span" pill tone="primary" className="px-2 font-bold">
              {obligationType?.name || "—"}
            </Badge>
          );
        },
      });
    }

    if (isColumnVisible("repMujtahid")) {
      cols.push({
        id: "repMujtahid",
        label: t("obligations.columns.repMujtahid"),
        cellClassName: "text-xs text-muted-foreground",
        render: (collection) => {
          const { rep, mujtahid } = getObligationCollectionResolvedFields(collection, helpers);
          return (
            <>
              <span>{rep?.name || "—"}</span>
              {mujtahid && (
                <span className="text-xs block text-muted-foreground">{mujtahid.name}</span>
              )}
            </>
          );
        },
      });
    }

    if (isColumnVisible("amount")) {
      cols.push({
        id: "amount",
        label: t("obligations.columns.amount"),
        noWrap: true,
        cellClassName: "font-semibold text-foreground",
        render: (collection) => formatObligationCollectionAmount(collection),
      });
    }

    if (isColumnVisible("paymentMode")) {
      cols.push({
        id: "paymentMode",
        label: t("obligations.columns.paymentMode"),
        noWrap: true,
        render: (collection) => (
          <StatusBadge status={collection.payment_mode} config={paymentModeConfig} size="sm" />
        ),
      });
    }

    if (isColumnVisible("reference")) {
      cols.push({
        id: "reference",
        label: t("obligations.columns.reference"),
        noWrap: true,
        cellClassName: "text-sm text-muted-foreground",
        render: (collection) => getContact(collection.reference_id)?.name || "—",
      });
    }

    if (isColumnVisible("currency")) {
      cols.push({
        id: "currency",
        label: t("obligations.columns.currency"),
        noWrap: true,
        cellClassName: "text-xs text-muted-foreground",
        render: (collection) =>
          OBLIGATION_COLLECTION_CURRENCIES.find(
            (currency) => currency.id === collection.currency_id,
          )?.code ||
          collection.currency_id ||
          "—",
      });
    }

    if (isColumnVisible("receivedBy")) {
      cols.push({
        id: "receivedBy",
        label: t("obligations.columns.receivedBy"),
        noWrap: true,
        cellClassName: "text-xs text-muted-foreground",
        render: (collection) =>
          collection.received_by
            ? userMap?.get(String(collection.received_by)) || collection.received_by
            : "—",
      });
    }

    return cols;
  }, [getContact, helpers, isColumnVisible, onViewVoucher, paymentModeConfig, t, userMap]);
}
