import React, { useMemo } from "react";
import { formatDate } from "@mms/shared";
import { EmptyState } from "@/components/app/EmptyState";

import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import type { WorkBatchTableFooterRow } from "@/components/common/work/workBatchTableTypes";
import { GeneralLedgerCardsView } from "./GeneralLedgerCardsView";
import { type Account } from "@/lib/data/accountingData";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";
import type { GeneralLedgerLineWithRunning } from "../hooks/useGeneralLedger";

interface GeneralLedgerEntriesProps {
  activeAccount: Account;
  linesWithRunning: GeneralLedgerLineWithRunning[];
  totalDebit: number;
  totalCredit: number;
  balance: number;
  dateFrom: string;
  dateTo: string;
  viewMode?: WorkDirectoryViewMode;
}

type GeneralLedgerRowItem = GeneralLedgerLineWithRunning & { id: string };

export function GeneralLedgerEntries({
  activeAccount,
  linesWithRunning,
  totalDebit,
  totalCredit,
  balance,
  dateFrom,
  dateTo,
  viewMode: propViewMode,
}: GeneralLedgerEntriesProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;

  const rows = useMemo<GeneralLedgerRowItem[]>(
    () => linesWithRunning.map((line, index) => ({ ...line, id: `${line.ref}-${index}` })),
    [linesWithRunning],
  );

  const columns = useMemo<WorkBatchTableColumn<GeneralLedgerRowItem>[]>(
    () => [
      {
        id: "date",
        label: t("accounting.ledger.columns.date"),
        noWrap: true,
        cellClassName: "px-3 py-2.5 text-xs text-muted-foreground",
        render: (line) => formatDate(line.date),
      },
      {
        id: "ref",
        label: t("accounting.ledger.columns.ref"),
        noWrap: true,
        cellClassName: "px-3 py-2.5 font-mono text-xs font-bold text-primary",
        render: (line) => line.ref,
      },
      {
        id: "description",
        label: t("accounting.ledger.columns.description"),
        truncate: true,
        cellClassName: "px-3 py-2.5 text-foreground max-w-cell-md",
        render: (line) => line.description,
      },
      {
        id: "lineNote",
        label: t("accounting.ledger.columns.lineNote"),
        headerClassName: "hidden lg:table-cell",
        cellClassName: "px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell",
        render: (line) => line.lineDesc || "—",
      },
      {
        id: "debit",
        label: t("accounting.ledger.columns.debit"),
        headerClassName: "text-end",
        noWrap: true,
        cellClassName: "px-3 py-2.5 text-end font-mono text-xs font-semibold text-info",
        render: (line) => (line.debit > 0 ? formatCurrency(line.debit) : "—"),
      },
      {
        id: "credit",
        label: t("accounting.ledger.columns.credit"),
        headerClassName: "text-end",
        noWrap: true,
        cellClassName: "px-3 py-2.5 text-end font-mono text-xs font-semibold text-success",
        render: (line) => (line.credit > 0 ? formatCurrency(line.credit) : "—"),
      },
      {
        id: "balance",
        label: t("accounting.ledger.columns.balance"),
        headerClassName: "text-end",
        noWrap: true,
        cellClassName: "px-3 py-2.5 text-end font-mono text-xs font-semibold",
        render: (line) => (
          <>
            <span className={line.running >= 0 ? "text-foreground" : "text-destructive"}>
              {formatCurrency(Math.abs(line.running))}
            </span>
            <span className="text-xs text-muted-foreground ms-1">
              {line.running >= 0 ? t("accounting.ledger.dr") : t("accounting.ledger.cr")}
            </span>
          </>
        ),
      },
    ],
    [formatCurrency, t],
  );

  if (linesWithRunning.length === 0) {
    return (
      <EmptyState
        variant="dashed"
        title={
          dateFrom || dateTo
            ? t("accounting.ledger.noPostedTransactionsPeriod")
            : t("accounting.ledger.noPostedTransactions")
        }
        compact
      />
    );
  }

  if (viewMode === "cards") {
    return (
      <GeneralLedgerCardsView
        linesWithRunning={linesWithRunning}
        totalDebit={totalDebit}
        totalCredit={totalCredit}
        balance={balance}
        formatCurrency={formatCurrency}
        t={t}
      />
    );
  }

  const footerRow: WorkBatchTableFooterRow = {
    className: "border-t-2 border-border bg-muted/30",
    cells: [
      {
        colSpan: 3,
        className: "table-footer-label",
        content: t("accounting.ledger.closingBalance"),
      },
      {
        className: "hidden lg:table-cell",
        content: null,
      },
      {
        className: "px-3 py-2.5 text-end font-mono font-bold text-info",
        content: formatCurrency(totalDebit),
      },
      {
        className: "px-3 py-2.5 text-end font-mono font-bold text-success",
        content: formatCurrency(totalCredit),
      },
      {
        className: "px-3 py-2.5 text-end font-mono font-bold text-foreground",
        content: (
          <>
            {formatCurrency(Math.abs(balance))}{" "}
            {balance >= 0 ? t("accounting.ledger.dr") : t("accounting.ledger.cr")}
          </>
        ),
      },
    ],
  };

  return (
    <WorkBatchTable
      data={rows}
      columns={columns}
      caption={t("accounting.ledger.entriesCaption", { name: activeAccount.name })}
      footerRow={footerRow}
    />
  );
}
