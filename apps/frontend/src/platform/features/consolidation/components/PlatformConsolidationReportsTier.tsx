import React, { useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { todayISO, type ConsolidationReportQuery } from "@mms/contracts";
import { Button } from "@mms/ui";
import { DatePicker } from "@mms/fe-core/components/DatePicker";
import { ErrorState } from "@/components/app/ErrorState";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { SectionCard } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { ConsolidationReportView } from "@/platform/features/consolidation/components/ConsolidationReportView";
import { exportConsolidationReportCsv } from "@/platform/features/consolidation/lib/exportConsolidationReportCsv";
import {
  useConsolidationGroups,
  useConsolidationReport,
} from "@/platform/features/consolidation/hooks/usePlatformConsolidation";

const startOfYear = (date: string) => `${date.slice(0, 4)}-01-01`;

/** Consolidation → Reports: run the consolidated trial balance for a group + period. */
export function PlatformConsolidationReportsTier(): React.JSX.Element {
  const { t } = useTranslation();
  const groups = useConsolidationGroups();
  const [selectedId, setSelectedId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(startOfYear(todayISO()));
  const [dateTo, setDateTo] = useState(todayISO());
  const [period, setPeriod] = useState<ConsolidationReportQuery | null>(null);

  const list = groups.data ?? [];
  const selected = list.find((group) => group.id === selectedId) ?? list[0] ?? null;
  const report = useConsolidationReport(selected?.id ?? null, period);

  return (
    <div className="space-y-4 text-start">
      {groups.isError ? (
        <ErrorState
          description={t("platform.consolidation.loadFailed")}
          onRetry={() => void groups.refetch()}
        />
      ) : (
        <SectionCard title={t("platform.consolidation.groups")} icon={BarChart3}>
          <div className="flex flex-wrap items-end gap-3">
            <Field id="cons-report-group" label={t("platform.consolidation.group")}>
              <FormSelect
                id="cons-report-group"
                name="group"
                value={selected?.id ?? ""}
                onChange={(value) => {
                  setSelectedId(value);
                  setPeriod(null);
                }}
                options={list.map((group) => ({
                  value: group.id,
                  label: `${group.name} (${group.presentationCurrency})`,
                }))}
              />
            </Field>
            <Field id="cons-report-from" label={t("platform.consolidation.dateFrom")}>
              <DatePicker
                id="cons-report-from"
                name="dateFrom"
                value={dateFrom}
                onChange={setDateFrom}
              />
            </Field>
            <Field id="cons-report-to" label={t("platform.consolidation.dateTo")}>
              <DatePicker id="cons-report-to" name="dateTo" value={dateTo} onChange={setDateTo} />
            </Field>
            <Button
              type="button"
              className="min-h-11"
              disabled={!selected}
              onClick={() => setPeriod({ dateFrom, dateTo })}
            >
              {t("platform.consolidation.run")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              icon={Download}
              disabled={!report.data}
              onClick={() => report.data && exportConsolidationReportCsv(report.data)}
              title={t("platform.consolidation.exportCsv")}
            >
              {t("platform.consolidation.exportCsv")}
            </Button>
          </div>
        </SectionCard>
      )}

      {report.isError ? (
        <ErrorState
          description={
            report.error instanceof Error
              ? report.error.message
              : t("platform.consolidation.reportFailed")
          }
          onRetry={() => void report.refetch()}
        />
      ) : null}
      {report.data ? <ConsolidationReportView report={report.data} /> : null}
    </div>
  );
}
