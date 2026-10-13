import React from "react";
import { BookOpen, Filter, CheckCircle2, FileEdit } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingMetrics } from "@/tenant/features/accounting/hooks/useAccountingApi";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";

interface AccountingCommandMetricsProps {
  entryTotal: number;
  shown: number;
}

export const AccountingCommandMetrics = function AccountingCommandMetrics({
  entryTotal,
  shown,
}: AccountingCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: serverMetrics } = useAccountingMetrics();

  const metrics = (() => ({
    totalEntries: serverMetrics?.totalEntries ?? entryTotal,
    posted: serverMetrics?.posted ?? 0,
    draft: serverMetrics?.draft ?? 0,
    activeAccounts: serverMetrics?.activeAccounts ?? 0,
    inactiveAccounts: serverMetrics?.inactiveAccounts ?? 0,
    newThisPeriod: serverMetrics?.newThisPeriod ?? 0,
    postedVolume: serverMetrics?.postedVolume ?? 0,
  }))();

  const items = (() => [
    {
      icon: BookOpen,
      label: t("accounting.metrics.totalEntries"),
      value: metrics.totalEntries,
      accent: "primary" as const,
    },
    {
      icon: Filter,
      label: t("accounting.metrics.filtered"),
      value: shown,
      accent: "info" as const,
    },
    {
      icon: CheckCircle2,
      label: t("accounting.metrics.posted"),
      value: metrics.posted,
      accent: "success" as const,
    },
    {
      icon: FileEdit,
      label: t("accounting.metrics.draft"),
      value: metrics.draft,
      accent: "warning" as const,
    },
  ])();

  return <ModuleCommandMetricsGrid items={items} />;
};
