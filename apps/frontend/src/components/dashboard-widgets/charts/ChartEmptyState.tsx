import React from "react";
import { ChartNoAxesColumn } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { useTranslation } from "@/hooks/useTranslation";

/** Localized empty state for a chart with no records (avoids fabricated axes). */
export function ChartEmptyState({ height = 200 }: { height?: number }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div style={{ minHeight: height }}>
      <EmptyState
        icon={ChartNoAxesColumn}
        title={t("dashboard.charts.noDataTitle")}
        description={t("dashboard.charts.noDataDesc")}
        variant="dashed"
        compact
      />
    </div>
  );
}

export default ChartEmptyState;
