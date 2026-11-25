import { getEnrollmentsHost } from "../host.js";

const host = () => (getEnrollmentsHost() as any).BrandingPaletteContext;
const DEFAULT_PALETTE = {
  primary: "#0f766e",
  secondary: "#b45309",
  charts: ["#0f766e", "#b45309", "#1d4ed8", "#9333ea"],
};

export function useBrandPalette(...args: any[]): any {
  const fn = host()?.useBrandPalette;
  return typeof fn === "function" ? fn(...args) : DEFAULT_PALETTE;
}

export const BrandingPaletteContext = {
  useBrandPalette,
};

export default BrandingPaletteContext;
