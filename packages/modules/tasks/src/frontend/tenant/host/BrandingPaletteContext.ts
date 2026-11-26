import { getTasksHost } from "../host.js";

export const BrandingPaletteContext: any = new Proxy(
  {},
  {
    get: (_t, prop) => (getTasksHost() as any).BrandingPaletteContext?.[prop],
  },
);

export function useBrandPalette(...args: any[]): any {
  return (getTasksHost() as any).BrandingPaletteContext?.useBrandPalette?.(...args);
}
