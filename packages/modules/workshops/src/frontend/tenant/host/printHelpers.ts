import { getWorkshopsHost } from "../host.js";

export function printTemplateDocument(...args: any[]): any {
  return (getWorkshopsHost() as any).printTemplateDocument(...args);
}

export function printHtmlDocument(...args: any[]): any {
  return (getWorkshopsHost() as any).printHtmlDocument(...args);
}

export const PRINT_NEUTRAL: Record<string, string> = new Proxy(
  {},
  { get: (_t, k) => (getWorkshopsHost() as any).printBrandingTokens?.[k] },
);
