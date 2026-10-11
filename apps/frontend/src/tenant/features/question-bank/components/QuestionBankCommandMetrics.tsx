import React from "react";
import { HelpCircle, Filter, Sparkles, BarChart3 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useQuestionBankMetrics } from "@/tenant/features/question-bank/hooks/useQuestionBankApi";
import { ModuleCommandMetricsGrid } from "@/components/ui/ModuleCommandMetricsGrid";

interface QuestionBankCommandMetricsProps {
  shown: number;
  total: number;
}

export const QuestionBankCommandMetrics = function QuestionBankCommandMetrics({
  shown,
  total,
}: QuestionBankCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: serverMetrics } = useQuestionBankMetrics();

  const metrics = (() => ({
    total: serverMetrics?.total ?? total,
    easy: serverMetrics?.easy ?? 0,
    medium: serverMetrics?.medium ?? 0,
    hard: serverMetrics?.hard ?? 0,
    totalTests: serverMetrics?.totalTests ?? 0,
    totalResults: serverMetrics?.totalResults ?? 0,
    categories: serverMetrics?.categories ?? 0,
  }))();

  const items = (() => [
    {
      icon: HelpCircle,
      label: t("questionBank.metrics.total"),
      value: metrics.total,
      accent: "primary" as const,
    },
    {
      icon: Filter,
      label: t("questionBank.metrics.filtered"),
      value: shown,
      accent: "info" as const,
    },
    {
      icon: Sparkles,
      label: t("questionBank.metrics.easy"),
      value: metrics.easy,
      accent: "success" as const,
    },
    {
      icon: BarChart3,
      label: t("questionBank.metrics.medium"),
      value: metrics.medium,
      accent: "warning" as const,
    },
  ])();

  return <ModuleCommandMetricsGrid items={items} />;
};
