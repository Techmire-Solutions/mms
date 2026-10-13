/** Sticky checkbox/name cell background aligned with selected/hover row tint. */
export function workTableStickyCellBg(isSelected: boolean): string {
  return isSelected ? "bg-primary/5 group-hover:bg-primary/10" : "bg-card group-hover:bg-muted/40";
}
