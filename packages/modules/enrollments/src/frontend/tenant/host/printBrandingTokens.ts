import { getEnrollmentsHost } from "../host.js";

const host = () => (getEnrollmentsHost() as any).printBrandingTokens;

export const printBrandingTokens: any = new Proxy(
  {},
  {
    get: (_t, prop) => host()?.[prop],
  },
);

export default printBrandingTokens;
