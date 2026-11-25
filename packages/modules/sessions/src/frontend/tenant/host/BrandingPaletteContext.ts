import { getSessionsHost } from "../host.js";

export const BrandingPaletteContext: any = new Proxy(
  {},
  {
    get: (_t, prop) => (getSessionsHost() as any).BrandingPaletteContext?.[prop],
  },
);

export function useBrandPalette(...args: any[]): any {
  return (getSessionsHost() as any).BrandingPaletteContext?.useBrandPalette?.(...args);
}
