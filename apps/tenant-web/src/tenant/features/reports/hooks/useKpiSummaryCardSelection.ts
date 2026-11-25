import { useEffect, useRef, useState } from "react";
import type { CustomCard } from "@/lib/reports/reportMetadata";
import {
  loadPreviousCustomCardIds,
  loadSelectedCardIdsForCategory,
  syncNewCustomCardSelections,
  syncSelectedCardIdsWithAvailable,
} from "@/tenant/features/reports/hooks/kpiSummaryCardSelection";
import type { CategorizedKPIItem } from "@/components/reports/kpiSummaryTypes";

export function useKpiSummaryCardSelection(
  category: string,
  role: string | undefined,
  possibleCards: CategorizedKPIItem[],
  customCards: CustomCard[],
) {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>(() =>
    loadSelectedCardIdsForCategory(category, role),
  );

  const availableCardIdsKey = (() =>
    possibleCards
      .filter((card) => card.isAvailable)
      .map((card) => card.id)
      .join("\u0000"))();

  useEffect(() => {
    syncSelectedCardIdsWithAvailable(
      possibleCards,
      availableCardIdsKey,
      category,
      role,
      selectedCardIds,
      setSelectedCardIds,
    );
  }, [availableCardIdsKey, category, role, selectedCardIds, possibleCards]);

  const previousCustomIdsRef = useRef<string[]>(loadPreviousCustomCardIds(category));
  const previousCustomIdsCategoryRef = useRef(category);
  useEffect(() => {
    if (previousCustomIdsCategoryRef.current !== category) {
      previousCustomIdsCategoryRef.current = category;
      previousCustomIdsRef.current = loadPreviousCustomCardIds(category);
    }
    syncNewCustomCardSelections(
      customCards,
      category,
      role,
      selectedCardIds,
      setSelectedCardIds,
      previousCustomIdsRef,
    );
  }, [customCards, category, role, selectedCardIds]);

  return { selectedCardIds, setSelectedCardIds };
}
