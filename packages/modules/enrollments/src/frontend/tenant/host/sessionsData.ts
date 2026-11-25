import { getEnrollmentsHost } from "../host.js";

const host = () => (getEnrollmentsHost() as any).sessionsData;

export const sessionsData: any = new Proxy(
  {},
  {
    get: (_t, prop) => host()?.[prop],
  },
);

export default sessionsData;

export const Session: any = new Proxy(
  {},
  {
    get: (_t, prop) => (getEnrollmentsHost() as any).sessionsData?.[prop],
  },
);

export type Class = any;
