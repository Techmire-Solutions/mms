import type { Session } from "@mms/contracts";
import { getAttendanceHost } from "../host.js";

export function useSessionsCollection(...args: unknown[]): Session[] {
  const fn = getAttendanceHost().sessionsCollection?.useSessionsCollection;
  const result = typeof fn === "function" ? fn(...args) : [];
  return Array.isArray(result) ? (result as Session[]) : [];
}
