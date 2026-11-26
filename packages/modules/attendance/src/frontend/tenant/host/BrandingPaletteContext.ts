import { getAttendanceHost } from "../host.js";

export function BrandingPaletteContext(...args: any[]): any {
  const v = (getAttendanceHost() as any).BrandingPaletteContext?.["BrandingPaletteContext"];
  return typeof v === "function" ? v(...args) : v;
}

export function useBrandPalette(...args: any[]): any {
  const v = (getAttendanceHost() as any).BrandingPaletteContext?.["useBrandPalette"];
  return typeof v === "function" ? v(...args) : v;
}
