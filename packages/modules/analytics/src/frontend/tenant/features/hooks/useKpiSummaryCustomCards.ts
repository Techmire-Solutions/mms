import { useEffect, useState } from "react";
import { useModuleWidgetAggregates } from "./useModuleWidgetAggregates";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import type { CustomCard } from "../../lib/reportMetadata";
import { computeCustomCardItems } from "./kpiSummaryCardHandlers";
import { cardsChangedOnLocalUpdate, loadCustomCardsForCategory } from "./kpiSummaryCardSelection";
import type { AggregateCardValue, CategorizedKPIItem } from "../../components/kpiSummaryTypes";
import type { KpiCategoryFlags } from "../../components/kpiSummaryCategoryFlags";
import type { KpiSummaryDataSources } from "./useKpiSummaryDataSources";

function buildServerAggregateMap(
  customCards: CustomCard[],
  widgetAggregates: Record<string, unknown> | undefined,
): Record<string, AggregateCardValue | undefined> {
  return Object.fromEntries(
    customCards.map((card: any) => {
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
  const [customCards, setCustomCards] = useState<CustomCard[]>(() =>
    loadCustomCardsForCategory(category),
  );

  const customCardWidgetInputs = (() =>
    customCards.map((card: any) => ({
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
      setCustomCards((previousCards: any) => cardsChangedOnLocalUpdate(previousCards, category));
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
