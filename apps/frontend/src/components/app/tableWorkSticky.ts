/**
 * Shared selected/hover tint for Work table rows and their sticky cells.
 *
 * Single source: the row and its sticky cell must not diverge (the old row used
 * `bg-accent/15` while the cell used `bg-primary/5`, and branding could darken
 * the row enough to break translucent badge contrast). The tint is kept light so
 * status/gender badges stay AA with a row selected and hovered.
 */
export const WORK_TABLE_ROW_TINT = {
  // Selected rows keep the card surface: tinting the whole row lowered the
  // effective contrast of translucent status/gender badges below AA even after
  // the badge hover fix. Selection is carried by the checkbox, the tinted sticky
  // cell, and the selection dock.
  selected: "bg-card hover:bg-card group-hover:bg-card",
  idle: "hover:bg-muted/40",
} as const;

/** Sticky checkbox/name cell background aligned with the selected/hover row tint. */
export function workTableStickyCellBg(isSelected: boolean): string {
  return isSelected ? "bg-primary/5 group-hover:bg-primary/10" : "bg-card group-hover:bg-muted/40";
}

/** Row-level selection tint shared with {@link workTableStickyCellBg}. */
export function workTableRowBg(isSelected: boolean): string {
  return isSelected ? WORK_TABLE_ROW_TINT.selected : WORK_TABLE_ROW_TINT.idle;
}
