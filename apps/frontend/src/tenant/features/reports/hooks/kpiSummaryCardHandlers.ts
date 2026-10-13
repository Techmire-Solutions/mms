import type { Permission } from "@mms/shared";
import type { Dispatch, SetStateAction } from "react";
import { saveObject } from "@/lib/db";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { CustomCard } from "@/lib/reports/reportMetadata";
import {
  KPI_ROLE_ATTENDANCE_ONLY_IDS,
  KPI_ROLE_FINANCE_ONLY_IDS,
  KPI_TITLE_KEYS,
} from "@/components/reports/kpiSummaryConfig";
import {
  buildAggregateCustomCard,
  getDefaultCardConfig,
} from "@/components/reports/kpiSummaryFormatters";
import { getKpiCategoryFlags } from "@/components/reports/kpiSummaryCategoryFlags";
import type {
  AggregateCardValue,
  CategorizedKPIItem,
  KPIItem,
} from "@/components/reports/kpiSummaryTypes";

const KPI_ROLE_ATTENDANCE_ONLY_SET = new Set(KPI_ROLE_ATTENDANCE_ONLY_IDS);
const KPI_ROLE_FINANCE_ONLY_SET = new Set(KPI_ROLE_FINANCE_ONLY_IDS);

export function filterStandardPossibleCards(
  standardCards: CategorizedKPIItem[],
  category: string,
  can: (permission: Permission) => boolean,
): CategorizedKPIItem[] {
  const { isFacultyCategory } = getKpiCategoryFlags(category);
  return standardCards.filter((card) => {
    const matchesCategory =
      card.categories.includes(category) ||
      (isFacultyCategory && card.categories.includes("faculty"));
    if (!matchesCategory) return false;
    if (can("attendance.write") && !can("finance.write")) {
      return KPI_ROLE_ATTENDANCE_ONLY_SET.has(card.id);
    }
    if (can("finance.write") && !can("attendance.write")) {
      return KPI_ROLE_FINANCE_ONLY_SET.has(card.id);
    }
    return true;
  });
}

export function buildPossibleCards(
  standardPossibleCards: CategorizedKPIItem[],
  computedCustomCards: CategorizedKPIItem[],
): CategorizedKPIItem[] {
  const customCardIds = new Set(computedCustomCards.map((card) => card.id));
  return [
    ...standardPossibleCards.filter((card) => !customCardIds.has(card.id)),
    ...computedCustomCards,
  ];
}

export function computeCustomCardItems(
  customCards: CustomCard[],
  category: string,
  t: TranslationFunction,
  serverAggregates: Record<string, AggregateCardValue | undefined>,
): CategorizedKPIItem[] {
  return customCards.map((card) => {
    const serverAggregate = serverAggregates[card.id];
    if (serverAggregate) return buildAggregateCustomCard(card, serverAggregate, category, t);
    return buildAggregateCustomCard(card, { value: 0, totalCount: 0 }, category, t);
  });
}

export function createKpiCardHandlers(
  category: string,
  role: string | undefined,
  customCards: CustomCard[],
  selectedCardIds: string[],
  setCustomCards: Dispatch<SetStateAction<CustomCard[]>>,
  setSelectedCardIds: Dispatch<SetStateAction<string[]>>,
  setEditingCardConfig: Dispatch<SetStateAction<CustomCard | null>>,
  editingCardConfig: CustomCard | null,
  setIsConfigOpen: Dispatch<SetStateAction<boolean>>,
) {
  const handleToggleCard = (cardId: string) => {
    setSelectedCardIds((previousCardIds) => {
      const s = new Set(previousCardIds);
      if (s.has(cardId)) {
        s.delete(cardId);
      } else {
        s.add(cardId);
      }
      const nextCardIds = [...s];
      saveObject(`kpi_config_${category}_${role || "all"}`, nextCardIds);
      return nextCardIds;
    });
  };

  const handleDeleteCustomCard = (cardId: string) => {
    const nextCustomCards = customCards.filter((card) => card.id !== cardId);
    const nextSelectedCardIds = selectedCardIds.filter(
      (selectedCardId) => selectedCardId !== cardId,
    );
    setCustomCards(nextCustomCards);
    setSelectedCardIds(nextSelectedCardIds);
    saveObject(`kpi_custom_cards_${category}`, nextCustomCards);
    saveObject(`kpi_config_${category}_${role || "all"}`, nextSelectedCardIds);
    if (editingCardConfig?.id === cardId) setEditingCardConfig(null);
    window.dispatchEvent(new Event("local-database-update"));
  };

  const handleEditCard = (card: KPIItem) => {
    const customCard = customCards.find((savedCard) => savedCard.id === card.id);
    const cardConfig = customCard ?? {
      ...getDefaultCardConfig(category, card.id, card.label, KPI_TITLE_KEYS[card.id]),
      id: `edit-default-${card.id}-${Date.now()}`,
    };
    setEditingCardConfig(cardConfig);
    document.getElementById(`config-panel-${category}`)?.scrollIntoView({ behavior: "smooth" });
  };

  const openCustomCardBuilder = () => {
    setIsConfigOpen(true);
    window.setTimeout(() => {
      document.getElementById(`config-panel-${category}`)?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return {
    handleToggleCard,
    handleDeleteCustomCard,
    handleEditCard,
    openCustomCardBuilder,
  };
}
