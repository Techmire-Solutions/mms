import type { Session } from "@mms/contracts";
import { useFinanceHostValue } from "../host.js";

export function useSessionsCollection(...args: unknown[]): Session[] {
  const fn = useFinanceHostValue().sessionsCollection?.useSessionsCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? (result as Session[]) : [];
}
