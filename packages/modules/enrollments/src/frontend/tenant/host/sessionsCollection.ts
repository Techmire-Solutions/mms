import { getEnrollmentsHost } from "../host.js";

const host = () => (getEnrollmentsHost() as any).sessionsCollection;

export function useSessionsCollection(..._args: any[]): any {
  return host();
}

export function useSessionDetail(...args: any[]): any {
  const fn = host()?.useSessionDetail;
  return typeof fn === "function" ? fn(...args) : { data: undefined, isLoading: false };
}

export function useSessions(...args: any[]): any {
  const fn = host()?.useSessions;
  return typeof fn === "function" ? fn(...args) : { sessions: [], isLoading: false };
}
