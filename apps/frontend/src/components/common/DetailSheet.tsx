import {
  DetailDrawerShell,
  type DrawerProps,
  type DrawerSide,
  type DrawerSize,
} from "@/components/app/DetailDrawerShell";

export type DetailSheetProps = DrawerProps;
export type DetailSheetSide = DrawerSide;
export type DetailSheetSize = DrawerSize;

/**
 * Canonical DetailSheet component re-exporting DetailDrawerShell for module slide-over surfaces.
 */
export const DetailSheet = DetailDrawerShell;
export { DetailDrawerShell };
