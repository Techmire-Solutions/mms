/**
 * Shared Work-directory multi-select helpers (Contacts gold-standard).
 * Checkbox toggles selection; page select-all merges/removes current page ids
 * without dropping selections from other pages.
 */

export function getDirectoryPageSelection(
  pageIds: ReadonlyArray<string | number>,
  selected: ReadonlyArray<string | number>,
): { allSelected: boolean; someSelected: boolean; selectedOnPage: number } {
  if (pageIds.length === 0) {
    return { allSelected: false, someSelected: false, selectedOnPage: 0 };
  }
  const selectedSet = new Set(selected);
  let selectedOnPage = 0;
  for (const id of pageIds) {
    if (selectedSet.has(id)) selectedOnPage += 1;
  }
  return {
    allSelected: selectedOnPage === pageIds.length,
    someSelected: selectedOnPage > 0 && selectedOnPage < pageIds.length,
    selectedOnPage,
  };
}

export function toggleIdInSelection<T extends string | number>(selected: readonly T[], id: T): T[] {
  const index = selected.indexOf(id);
  if (index >= 0) {
    const next = [...selected];
    next.splice(index, 1);
    return next;
  }
  return [...selected, id];
}

/** Toggle current-page ids into/out of selection (keeps other pages). */
export function togglePageIdsInSelection<T extends string | number>(
  selected: readonly T[],
  pageIds: readonly T[],
): T[] {
  if (pageIds.length === 0) return [...selected];
  const selectedSet = new Set(selected);
  const allOnPage = pageIds.every((id) => selectedSet.has(id));
  if (allOnPage) {
    const pageSet = new Set(pageIds);
    return selected.filter((id) => !pageSet.has(id));
  }
  const next = new Set(selected);
  for (const id of pageIds) next.add(id);
  return [...next];
}

export interface StandardContactEntity {
  id: string | number;
  phone?: string | null;
  email?: string | null;
}

export interface MessagingSelectionTargets<T> {
  waTargets: T[];
  smsReady: T[];
  emailReady: T[];
}

/** Partition selected entities into WhatsApp, SMS, and Email eligible arrays. */
export function partitionMessagingTargets<T extends StandardContactEntity>(
  selectedIds: ReadonlyArray<string | number>,
  rows: readonly T[],
): MessagingSelectionTargets<T> {
  if (selectedIds.length === 0 || rows.length === 0) {
    return { waTargets: [], smsReady: [], emailReady: [] };
  }
  const selectedSet = new Set(selectedIds.map(String));
  const waTargets: T[] = [];
  const smsReady: T[] = [];
  const emailReady: T[] = [];

  for (const row of rows) {
    if (!selectedSet.has(String(row.id))) continue;
    const phone = row.phone?.trim();
    const email = row.email?.trim();
    if (phone) {
      waTargets.push(row);
      smsReady.push(row);
    }
    if (email && email.includes("@")) {
      emailReady.push(row);
    }
  }

  return { waTargets, smsReady, emailReady };
}
