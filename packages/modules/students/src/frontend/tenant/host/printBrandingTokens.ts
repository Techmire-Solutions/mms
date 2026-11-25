import { getStudentsHost } from "../host.js";

export function getPrintBrandingTokens(...args: any[]): any {
  return (getStudentsHost() as any).printBrandingTokens?.getPrintBrandingTokens?.(...args) ?? {};
}

export const printBrandingTokens: Record<string, unknown> = {};
