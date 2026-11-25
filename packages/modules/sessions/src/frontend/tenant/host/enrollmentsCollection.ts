import { getSessionsHost } from "../host.js";

export const enrollmentsCollection: any = new Proxy(
  {},
  {
    get: (_t, prop) => (getSessionsHost() as any).enrollmentsCollection?.[prop],
  },
);

export function useEnrollmentsCollection(..._args: any[]): Record<string, (...args: any[]) => any> {
  return (getSessionsHost() as any).enrollmentsCollection;
}

export function invalidateEnrollmentsQueries(...args: any[]): void {
  (getSessionsHost() as any).invalidation?.invalidateEnrollmentsQueries?.(...args);
}
