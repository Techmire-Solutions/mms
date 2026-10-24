import { type TooltipContentProps, type TooltipPayloadEntry } from "recharts";
import { ChartTooltip, ChartTooltipRow } from "@/components/app/ChartTooltip";
import { useTranslation } from "@/hooks/useTranslation";
import { useFinanceCurrency } from "@/hooks/useCurrency";

export function RevenueChartTooltip({
  active = false,
  payload = [],
  label = "",
}: Partial<TooltipContentProps>) {
  const { t } = useTranslation();
  const { formatCurrency } = useFinanceCurrency();
  return (
    <ChartTooltip
      active={active}
      payload={payload}
      label={label}
      labelClassName="text-muted-foreground/80 font-bold"
      className="px-4 py-3 space-y-1.5"
    >
      {payload.map((payloadEntry: TooltipPayloadEntry) => (
        <ChartTooltipRow
          key={payloadEntry.dataKey as string | number}
          color={payloadEntry.color}
          name={
            payloadEntry.dataKey === "revenue"
              ? t("accounting.dashboard.revenue")
              : t("accounting.dashboard.expenses")
          }
          nameClassName="capitalize"
          value={formatCurrency(Number(payloadEntry.value))}
        />
      ))}
    </ChartTooltip>
  );
}
