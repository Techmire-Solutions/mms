import { useEffect, useState } from "react";
import { useModuleWidgetAggregates } from "@/tenant/features/reports/hooks/useModuleWidgetAggregates";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { CustomCard } from "@/lib/reports/reportMetadata";
import { computeCustomCardItems } from "@/tenant/features/reports/hooks/kpiSummaryCardHandlers";
import {
  cardsChangedOnLocalUpdate,
  loadCustomCardsForCategory,
} from "@/tenant/features/reports/hooks/kpiSummaryCardSelection";
import type { AggregateCardValue, CategorizedKPIItem } from "@/components/reports/kpiSummaryTypes";
import type { KpiCategoryFlags } from "@/components/reports/kpiSummaryCategoryFlags";
import type { KpiSummaryDataSources } from "@/tenant/features/reports/hooks/useKpiSummaryDataSources";

function buildServerAggregateMap(
  customCards: CustomCard[],
  widgetAggregates: Record<string, unknown> | undefined,
): Record<string, AggregateCardValue | undefined> {
  return Object.fromEntries(
    customCards.map((card) => {
      const serverAggregate = widgetAggregates?.[card.id] as AggregateCardValue | undefined;
      return [card.id, serverAggregate];
    }),
  );
}

export function useKpiSummaryCustomCards(
  category: string,
  flags: KpiCategoryFlags,
  dataSources: KpiSummaryDataSources,
  t: TranslationFunction,
) {
  const {
    isContactsCategory,
    isStudentsCategory,
    isFacultyCategory,
    isSessionsCategory,
    isEnrollmentsCategory,
  } = flags;
  const {
    questionBankQuestions: qbFromMetricsPath,
    questionBankTests: qbTestsFromMetricsPath,
    questionBankResults: qbResultsFromMetricsPath,
  } = dataSources;

  const [customCards, setCustomCards] = useState<CustomCard[]>(() =>
    loadCustomCardsForCategory(category),
  );

  const customCardWidgetInputs = (() =>
    customCards.map((card) => ({
      id: card.id,
      collection: card.collection,
      operation: card.operation,
      targetField: card.targetField,
      filterField: card.filterField,
      filterOperator: card.filterOperator,
      filterValue: card.filterValue,
    })))();

  const { data: widgetAggregates } = useModuleWidgetAggregates(customCardWidgetInputs);

  useEffect(() => {
    const handleUpdate = () => {
      setCustomCards((previousCards) => cardsChangedOnLocalUpdate(previousCards, category));
    };
    window.addEventListener("local-database-update", handleUpdate);
    return () => window.removeEventListener("local-database-update", handleUpdate);
  }, [category]);

  const computedCustomCards = ((): CategorizedKPIItem[] =>
    computeCustomCardItems(
      customCards,
      category,
      t,
      buildServerAggregateMap(customCards, widgetAggregates),
    ))();

  return { customCards, setCustomCards, computedCustomCards };
}
