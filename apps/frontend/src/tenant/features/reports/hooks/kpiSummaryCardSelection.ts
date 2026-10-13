import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { getObject, saveObject } from "@/lib/db";
import type { CustomCard } from "@/lib/reports/reportMetadata";
import { areCustomCardsEqual, areStringListsEqual } from "@/components/reports/kpiSummaryConfig";
import { normalizeStoredCardIds } from "@/components/reports/kpiSummaryFormatters";
import type { CategorizedKPIItem } from "@/components/reports/kpiSummaryTypes";

export interface KpiCardSelectionState {
  customCards: CustomCard[];
  selectedCardIds: string[];
}

export interface KpiCardSelectionSetters {
  setCustomCards: Dispatch<SetStateAction<CustomCard[]>>;
  setSelectedCardIds: Dispatch<SetStateAction<string[]>>;
}

/** Syncs selected card ids when available cards change. */
export function syncSelectedCardIdsWithAvailable(
  possibleCards: CategorizedKPIItem[],
  availableCardIdsKey: string,
  category: string,
  role: string | undefined,
  selectedCardIds: string[],
  setSelectedCardIds: Dispatch<SetStateAction<string[]>>,
): void {
  const availableCards = possibleCards.filter((card) => card.isAvailable);
  const availableCardIds = availableCardIdsKey ? availableCardIdsKey.split("\u0000") : [];
  const availableCardIdSet = new Set(availableCardIds);
  const selectedIds = normalizeStoredCardIds(selectedCardIds, availableCards);
  let validSelectedCardIds = selectedIds.filter((cardId: string) => availableCardIdSet.has(cardId));
  if (validSelectedCardIds.length === 0 && availableCardIds.length > 0) {
    validSelectedCardIds = availableCardIds;
  }
  if (areStringListsEqual(selectedCardIds, validSelectedCardIds)) return;
  saveObject(`kpi_config_${category}_${role || "all"}`, validSelectedCardIds);
  setSelectedCardIds(validSelectedCardIds);
}

/** Appends newly added custom card ids to the selected set. */
export function syncNewCustomCardSelections(
  customCards: CustomCard[],
  category: string,
  role: string | undefined,
  selectedCardIds: string[],
  setSelectedCardIds: Dispatch<SetStateAction<string[]>>,
  previousCustomIdsRef: MutableRefObject<string[]>,
): void {
  const currentIds = customCards.map((card) => card.id);
  const prevSet = new Set(previousCustomIdsRef.current);
  const newlyAdded = currentIds.filter((id) => !prevSet.has(id));
  if (!areStringListsEqual(previousCustomIdsRef.current, currentIds)) {
    saveObject(`prev_kpi_ids_${category}`, currentIds);
  }
  previousCustomIdsRef.current = currentIds;
  if (newlyAdded.length === 0) return;
  const nextSelectedCardIds = [...new Set([...selectedCardIds, ...newlyAdded])];
  if (areStringListsEqual(selectedCardIds, nextSelectedCardIds)) return;
  saveObject(`kpi_config_${category}_${role || "all"}`, nextSelectedCardIds);
  setSelectedCardIds(nextSelectedCardIds);
}

export function loadCustomCardsForCategory(category: string): CustomCard[] {
  return getObject<CustomCard[]>(`kpi_custom_cards_${category}`, []);
}

export function loadSelectedCardIdsForCategory(category: string, role?: string): string[] {
  return getObject<string[]>(`kpi_config_${category}_${role || "all"}`, []);
}

export function loadPreviousCustomCardIds(category: string): string[] {
  return getObject<string[]>(`prev_kpi_ids_${category}`, []);
}

export function cardsChangedOnLocalUpdate(
  previousCards: CustomCard[],
  category: string,
): CustomCard[] {
  const nextCards = getObject<CustomCard[]>(`kpi_custom_cards_${category}`, []);
  return areCustomCardsEqual(previousCards, nextCards) ? previousCards : nextCards;
}
