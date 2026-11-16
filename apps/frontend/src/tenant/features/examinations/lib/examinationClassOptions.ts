import { isSessionReadOnly } from "@mms/shared";

interface SessionClassLike {
  id: string;
  name: string;
}

interface SessionLike {
  id: string;
  name: string;
  status: string;
  classes?: readonly SessionClassLike[] | null;
}

/**
 * Class choices for an exam form. Terminal sessions (completed/cancelled/archived)
 * are history: scoping an exam to their classes would be writable against a dead
 * session, and the backend `classIds` contract has no session-status guard.
 */
export function examinationClassOptions(
  sessions: readonly SessionLike[],
): Array<{ id: string; name: string }> {
  return sessions
    .filter((session) => !isSessionReadOnly(session.status))
    .flatMap((session) =>
      (session.classes ?? []).map((sessionClass) => ({
        id: sessionClass.id,
        name: `${session.name} - ${sessionClass.name}`,
      })),
    );
}
