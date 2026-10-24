import type { DrawerSide, DrawerSize } from "./Drawer";

export const DRAWER_SIZE_MAP: Record<DrawerSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  full: "sm:max-w-4xl",
};

export function getDrawerContainerPlacement(side: DrawerSide): string {
  if (side === "bottom") return "flex items-end justify-center";
  if (side === "start") return "flex items-center justify-start";
  if (side === "end") return "flex items-center justify-end";
  return "flex items-end sm:items-center justify-end";
}

export function getDrawerPanelBorder(side: DrawerSide): string {
  if (side === "bottom") return "border-t rounded-t-3xl max-h-drawer";
  if (side === "start") return "border-e rounded-none h-full";
  if (side === "end") return "border-s rounded-none h-full";
  return "border-t sm:border-t-0 sm:border-s max-h-drawer sm:max-h-full rounded-t-3xl sm:rounded-none h-full";
}
