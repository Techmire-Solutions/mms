import type React from "react";
import {
  formatMoney,
  type ConsolidatedRow,
  type ConsolidationReport,
  type TranslatedRow,
} from "@mms/shared";
import { StatCard } from "@/components/app/StatCard";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { useTranslation } from "@/hooks/useTranslation";

interface ConsolidationReportViewProps {
  report: ConsolidationReport;
}

type ConsolidatedRowWithId = ConsolidatedRow & { id: string };
type TranslatedRowWithId = TranslatedRow & { id: string };

/** Consolidated trial balance (combined → eliminations → group) plus each member's translation. */
export function ConsolidationReportView({
  report,
}: ConsolidationReportViewProps): React.JSX.Element {
  const { t } = useTranslation();
  const currency = report.consolidated.presentationCurrency;
  const money = (amount: number, ccy = currency) => formatMoney(amount, ccy, { useSymbol: true });
  const amountCell = (amount: number, ccy?: string) => (
    <span className="font-mono">{money(amount, ccy)}</span>
  );

  const consolidatedColumns: DataTableColumn<ConsolidatedRowWithId>[] = [
    {
      id: "code",
      label: t("platform.consolidation.account"),
      fixed: true,
      render: (row) => `${row.code} – ${row.name}`,
    },
    { id: "type", label: t("platform.consolidation.type"), render: (row) => row.type },
    {
      id: "combined",
      label: t("platform.consolidation.combined"),
      render: (row) => amountCell(row.combined),
    },
    {
      id: "elimination",
      label: t("platform.consolidation.elimination"),
      render: (row) => amountCell(row.elimination),
    },
    {
      id: "balance",
      label: t("platform.consolidation.groupBalance"),
      render: (row) => amountCell(row.balance),
    },
  ];

  const memberColumns = (functionalCurrency: string): DataTableColumn<TranslatedRowWithId>[] => [
    {
      id: "code",
      label: t("platform.consolidation.account"),
      fixed: true,
      render: (row) => `${row.code} – ${row.name}`,
    },
    {
      id: "functional",
      label: t("platform.consolidation.functionalBalance"),
      render: (row) => amountCell(row.functionalBalance, functionalCurrency),
    },
    {
      id: "rate",
      label: t("platform.consolidation.rate"),
      render: (row) => <span className="font-mono">{row.rate}</span>,
    },
    {
      id: "translated",
      label: t("platform.consolidation.translated"),
      render: (row) => amountCell(row.balance),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t("platform.consolidation.cta")} value={money(report.consolidated.cta)} />
        <StatCard
          label={t("platform.consolidation.nci")}
          value={money(report.consolidated.nonControllingInterest)}
        />
        <StatCard
          label={t("platform.consolidation.balanced")}
          value={`${money(report.consolidated.totals.debit)} / ${money(report.consolidated.totals.credit)}`}
        />
      </div>

      <DataTable
        tableId="platform.consolidation.consolidated"
        label={t("platform.consolidation.consolidatedTb")}
        data={report.consolidated.rows.map((row) => ({ ...row, id: row.code }))}
        columns={consolidatedColumns}
        card={{ title: (row) => `${row.code} – ${row.name}` }}
      />

      {report.members.map((member) => (
        <section
          key={member.memberSubdomain}
          className="space-y-2"
          aria-labelledby={`cons-member-${member.memberSubdomain}`}
        >
          <h3
            id={`cons-member-${member.memberSubdomain}`}
            className="m-0 text-sm font-semibold text-balance"
          >
            {t("platform.consolidation.memberTranslation", {
              member: member.memberSubdomain,
              from: member.functionalCurrency,
              to: currency,
              cta: money(member.cta),
            })}
          </h3>
          <DataTable
            tableId={`platform.consolidation.member.${member.memberSubdomain}`}
            label={member.memberSubdomain}
            data={member.rows.map((row) => ({ ...row, id: row.code }))}
            columns={memberColumns(member.functionalCurrency)}
            card={{ title: (row) => `${row.code} – ${row.name}` }}
          />
        </section>
      ))}
    </div>
  );
}
