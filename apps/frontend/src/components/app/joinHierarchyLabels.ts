/**
 * @file joinHierarchyLabels.ts
 * @description BiDi-safe join for hierarchy / reporting label strips (no LTR arrows).
 */

/** Neutral middle-dot separator — reads correctly in LTR and RTL without physical arrows. */
export const HIERARCHY_LABEL_SEPARATOR = " · ";

export function joinHierarchyLabels(labels: readonly string[]): string {
  return labels.filter((label) => label.trim().length > 0).join(HIERARCHY_LABEL_SEPARATOR);
}
