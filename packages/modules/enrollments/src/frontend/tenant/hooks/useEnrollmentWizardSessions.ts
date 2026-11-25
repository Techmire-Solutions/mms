import { useMemo } from "react";
import type { Session } from "@mms/contracts";
import { useSessions } from "../host/sessionsCollection";

export function useEnrollmentWizardSessions() {
  const sessionsQuery = useSessions();
  const sessions = useMemo(() => {
    const body = sessionsQuery.data?.status === 200 ? sessionsQuery.data.body : null;
    if (Array.isArray(body)) return body as Session[];
    if (body && typeof body === "object" && "sessions" in body && Array.isArray(body.sessions)) {
      return body.sessions as Session[];
    }
    return [] as Session[];
  }, [sessionsQuery.data]);

  return { sessions, sessionsQuery };
}
