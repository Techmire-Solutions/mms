import { useMemo } from "react";
import { type Session } from "@/lib/data/sessionsData";
import { useSessions } from "@/tenant/hooks/collections/sessions";

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
