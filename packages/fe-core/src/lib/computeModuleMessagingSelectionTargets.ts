/**
 * Pure eligibility for bulk messaging from current-page rows ∩ selected ids.
 * Modules supply channel predicates; Contacts may omit email.
 */
export function computeModuleMessagingSelectionTargets<T extends { id: string | number }>({
  selectedIds,
  rows,
  hasWhatsApp,
  hasSms,
  hasEmail,
}: {
  selectedIds: ReadonlyArray<string | number>;
  rows: readonly T[];
  hasWhatsApp: (row: T) => boolean;
  hasSms: (row: T) => boolean;
  hasEmail?: (row: T) => boolean;
}): { waTargets: T[]; smsReady: T[]; emailReady: T[] } {
  if (selectedIds.length === 0) {
    return { waTargets: [], smsReady: [], emailReady: [] };
  }

  const selectedSet = new Set(selectedIds.map(String));
  const waTargets: T[] = [];
  const smsReady: T[] = [];
  const emailReady: T[] = [];

  for (const row of rows) {
    if (!selectedSet.has(String(row.id))) continue;
    if (hasWhatsApp(row)) waTargets.push(row);
    if (hasSms(row)) smsReady.push(row);
    if (hasEmail?.(row)) emailReady.push(row);
  }

  return { waTargets, smsReady, emailReady };
}
