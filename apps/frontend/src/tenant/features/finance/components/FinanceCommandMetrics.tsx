import React from "react";
import { ReceiptText, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useFinanceMetrics } from "@/tenant/features/finance/hooks/useFinanceMetrics";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";

export interface FinanceCommandMetricsProps {
  invoiceTotal: number;
}

export const FinanceCommandMetrics = function FinanceCommandMetrics({
  invoiceTotal,
}: FinanceCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: serverMetrics } = useFinanceMetrics();

  const metrics = (() => ({
    totalInvoices: serverMetrics?.totalInvoices ?? invoiceTotal,
    outstanding: serverMetrics?.outstanding ?? 0,
    overdue: serverMetrics?.overdue ?? 0,
    paid: serverMetrics?.paid ?? 0,
    partial: serverMetrics?.partial ?? 0,
    totalPayments: serverMetrics?.totalPayments ?? 0,
  }))();

  const items = (() => [
    {
      icon: ReceiptText,
      label: t("finance.metrics.totalInvoices"),
      value: metrics.totalInvoices,
      accent: "primary" as const,
    },
    {
      icon: Clock,
      label: t("finance.metrics.outstanding"),
      value: metrics.outstanding,
      accent: "warning" as const,
    },
    {
      icon: AlertTriangle,
      label: t("finance.metrics.overdue"),
      value: metrics.overdue,
      accent: "destructive" as const,
    },
    {
      icon: CheckCircle2,
      label: t("finance.metrics.paid"),
      value: metrics.paid,
      accent: "success" as const,
    },
  ])();

  return <ModuleCommandMetricsGrid items={items} />;
};
