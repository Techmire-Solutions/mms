import type { Session } from "@mms/contracts";
import { getEnrollmentsHost } from "../host.js";

const host = () => getEnrollmentsHost().sessionsCollection;

export function useSessionsCollection(...args: unknown[]): Session[] {
  const fn = host()?.useSessionsCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? (result as Session[]) : [];
}

export function useSessionDetail(...args: unknown[]) {
  const fn = host()?.useSessionDetail;
  return typeof fn === "function" ? fn(...args) : null;
}

export function useSessions(...args: unknown[]) {
  const fn = host()?.useSessions;
  return typeof fn === "function" ? fn(...args) : { data: undefined, isLoading: false };
}
