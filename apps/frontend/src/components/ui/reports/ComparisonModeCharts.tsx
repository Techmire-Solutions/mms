import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { ReportChartCard } from "./ReportChartCard";
import { useTranslation } from "@/hooks/useTranslation";
import { formatNumber } from "@mms/shared";
import { Bar, BarChart, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { ChartGrid, chartAxisTick } from "@/components/ui/ChartGrid";
import { ChartTooltip, ChartTooltipRow } from "@/components/ui/ChartTooltip";

import type { ComparisonDataItem, DateRangeDataItem } from "./comparisonModeTypes";
import { WORK_SURFACE, WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { StatGrid, StatRow } from "@/components/ui/StatGrid";
import { ModuleTableHeaderCell } from "@/components/ui/ModuleTableHeaderCell";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";

type ComparisonModeChartData = Array<ComparisonDataItem | DateRangeDataItem>;

interface ComparisonModeChartsProps {
  mode: "sessions" | "daterange";
  translatedData: ComparisonModeChartData;
  labelA: string | undefined;
  labelB: string | undefined;
  isContacts: boolean;
}

export function ComparisonModeCharts({
  mode,
  translatedData,
  labelA,
  labelB,
  isContacts,
}: ComparisonModeChartsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { primary, secondary } = useBrandPalette();
  const { formatCurrency } = useFinanceCurrency();

  const formatVal = (val: number, key?: string) => {
    if (key === "feeCollected") return formatCurrency(val);
    if (key === "attendancePct" || key === "passRatePct") return `${val}%`;
    return formatNumber(val);
  };

  const formatDiff = (diff: number, key?: string) => {
    const sign = diff > 0 ? "+" : "";
    if (key === "feeCollected") return `${sign}${formatCurrency(diff)}`;
    if (key === "attendancePct" || key === "passRatePct") return `${sign}${diff}%`;
    return `${sign}${formatNumber(diff)}`;
  };

  const sessionRows = translatedData as ComparisonDataItem[];

  return (
    <>
      <ReportChartCard
        title={t("reports.moduleTools.compare")}
        subtitle={`${t("reports.comparison.comparing")} ${labelA || ""} ${t("reports.comparison.vs")} ${labelB || ""}`}
        heightClass="h-panel-sm"
        accentColor="primary"
      >
        <BarChart data={translatedData} barSize={22}>
          <ChartGrid />
          <XAxis dataKey={mode === "sessions" ? "metric" : "month"} tick={chartAxisTick(11)} />
          <YAxis tick={chartAxisTick(11)} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <ChartTooltip active={active} payload={payload} label={label}>
                  <div className="mt-1 space-y-1">
                    {payload.map((entry) => (
                      <ChartTooltipRow
                        key={String(entry.dataKey ?? entry.name)}
                        color={entry.color}
                        name={entry.name}
                        value={formatVal(Number(entry.value))}
                      />
                    ))}
                  </div>
                </ChartTooltip>
              );
            }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="a" name={labelA} fill={primary} radius={[4, 4, 0, 0]} />
          <Bar dataKey="b" name={labelB} fill={secondary} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ReportChartCard>

      {mode === "sessions" && (
        <div className={`${WORK_SURFACE} overflow-hidden`}>
          <div className="space-y-3 p-3 md:hidden">
            {sessionRows.map((row) => {
              const diff = parseFloat((row.a - row.b).toFixed(1));
              return (
                <article key={row.metric} className={`${WORK_SURFACE_INNER} space-y-2 p-3`}>
                  <h4 className="text-sm font-bold text-foreground m-0">{row.metric}</h4>
                  <StatGrid>
                    <StatRow
                      label={
                        isContacts
                          ? t("reports.comparison.targetA")
                          : t("reports.comparison.sessionA")
                      }
                      value={formatVal(row.a, row.metricKey)}
                      dtClassName="text-primary"
                      ddClassName="font-bold text-primary"
                    />
                    <StatRow
                      label={
                        isContacts
                          ? t("reports.comparison.targetB")
                          : t("reports.comparison.sessionB")
                      }
                      value={formatVal(row.b, row.metricKey)}
                      dtClassName="text-warning"
                      ddClassName="font-bold text-warning"
                    />
                    <StatRow
                      fullWidth
                      label={t("reports.comparison.diff")}
                      value={formatDiff(diff, row.metricKey)}
                      ddClassName={`text-xs font-black ${diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}
                    />
                  </StatGrid>
                </article>
              );
            })}
          </div>
          <div className="hidden md:block">
            <Table>
              <caption className="sr-only">{t("reports.comparison.title")}</caption>
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                  <ModuleTableHeaderCell columnKey="metric" className="px-3 py-2.5">
                    {t("reports.comparison.metric")}
                  </ModuleTableHeaderCell>
                  <ModuleTableHeaderCell columnKey="a" className="px-3 py-2.5 text-primary">
                    {isContacts
                      ? t("reports.comparison.targetA")
                      : t("reports.comparison.sessionA")}
                  </ModuleTableHeaderCell>
                  <ModuleTableHeaderCell columnKey="b" className="px-3 py-2.5 text-warning">
                    {isContacts
                      ? t("reports.comparison.targetB")
                      : t("reports.comparison.sessionB")}
                  </ModuleTableHeaderCell>
                  <ModuleTableHeaderCell columnKey="diff" className="px-3 py-2.5">
                    {t("reports.comparison.diff")}
                  </ModuleTableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/50">
                {sessionRows.map((row) => {
                  const diff = parseFloat((row.a - row.b).toFixed(1));

                  return (
                    <TableRow key={row.metric} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="px-3 py-2.5 font-bold text-foreground">
                        {row.metric}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-primary font-bold">
                        {formatVal(row.a, row.metricKey)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-warning font-bold">
                        {formatVal(row.b, row.metricKey)}
                      </TableCell>
                      <TableCell
                        className={`px-3 py-2.5 text-xs font-black ${diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {formatDiff(diff, row.metricKey)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}
