import React from "react";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { formatMoney } from "@mms/shared";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";

interface BudgetOverviewCardsProps {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  currency?: string;
}

export function BudgetOverviewCards({
  totalIncome,
  totalExpenses,
  balance,
  currency,
}: BudgetOverviewCardsProps): React.JSX.Element {
  const { t } = useTranslation();

  const stats = [
    {
      label: t("sessions.budget.totalIncome"),
      value: totalIncome,
      icon: TrendingUp,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: t("sessions.budget.totalExpenses"),
      value: totalExpenses,
      icon: TrendingDown,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: t("sessions.budget.netBalance"),
      value: balance,
      icon: Wallet,
      color: balance >= 0 ? "text-success" : "text-destructive",
      bg: balance >= 0 ? "bg-success/10" : "bg-destructive/10",
    },
  ];

  return (
    <section
      aria-label={t("sessions.budget.summaryAria")}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {stats.map((stat) => (
        <article key={stat.label} className={`${WORK_SURFACE_INNER} p-4`}>
          <div
            className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}
            aria-hidden="true"
          >
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
          </div>
          <p className={`text-base font-bold ${stat.color} m-0`}>
            {formatMoney(stat.value, currency)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 m-0">{stat.label}</p>
        </article>
      ))}
    </section>
  );
}
