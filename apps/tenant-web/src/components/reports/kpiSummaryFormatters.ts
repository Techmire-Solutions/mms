import { Users, type LucideIcon } from "lucide-react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { resolveWidgetSubText, resolveWidgetTitle } from "@/lib/dashboardWidgets";
import type { CustomCard } from "@/lib/reports/reportMetadata";
import type { AggregateCardValue, CategorizedKPIItem, KPIItem } from "./kpiSummaryTypes";
import { KPI_ICONS } from "./kpiSummaryIcons";

export { KPI_ICONS } from "./kpiSummaryIcons";
export {
  getDefaultCardConfig,
  getDefaultKPICollection,
  getCategoryLabelKey,
} from "./kpiDefaultCardConfig";

export function normalizeStoredCardIds(
  storedValues: string[],
  cards: CategorizedKPIItem[],
): string[] {
  const cardByLabel = new Map(cards.map((card) => [card.label, card.id]));
  const cardIdSet = new Set(cards.map((card) => card.id));
  const resolvedIds: string[] = [];
  for (const storedValue of storedValues) {
    const resolvedId = cardIdSet.has(storedValue) ? storedValue : cardByLabel.get(storedValue);
    if (resolvedId && !resolvedIds.includes(resolvedId)) {
      resolvedIds.push(resolvedId);
    }
  }
  return resolvedIds;
}

export function formatAggregateCardValue(
  card: CustomCard,
  aggregate: AggregateCardValue,
): { finalValue: string | number; totalCount: number } {
  return {
    finalValue: card.operation === "percentage" ? `${aggregate.value}%` : aggregate.value,
    totalCount: aggregate.totalCount,
  };
}

export function buildAggregateCustomCard(
  card: CustomCard,
  aggregate: AggregateCardValue,
  category: string,
  t: TranslationFunction,
): CategorizedKPIItem {
  const aggregateValue = formatAggregateCardValue(card, aggregate);
  return {
    id: card.id,
    label: resolveWidgetTitle(card, t),
    value: String(aggregateValue.finalValue),
    sub:
      resolveWidgetSubText(card, t) ||
      t("reports.widgets.totalCountText", { count: aggregateValue.totalCount }),
    icon: (KPI_ICONS[card.icon] || Users) as LucideIcon,
    color: (card.color === "emerald" ? "green" : card.color) as KPIItem["color"],
    trend: "flat",
    isAvailable: aggregateValue.totalCount > 0,
    categories: [category],
  };
}
