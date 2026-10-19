import { randomUUID } from "node:crypto";
import { addIsoDays } from "@mms/shared";
import { attendanceCalendarRepository as repo } from "../repository/attendanceCalendarRepositoryAdapter.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { ACADEMIC_CALENDAR_BROADCAST_KEY } from "./academicCalendarUseCases.js";

/**
 * Copies a session's own calendar events (session / class / section scope) into a new session,
 * shifted by `offsetDays`; class and section scopes follow the id maps of the copy.
 */
export async function copySessionCalendarEvents(
  tenant: string,
  input: {
    sourceSessionId: string;
    targetSessionId: string;
    range: { from: string; to: string };
    offsetDays: number;
    classIds: ReadonlyMap<string, string>;
    sectionIds: ReadonlyMap<string, string>;
    actorUserId: string;
  },
): Promise<number> {
  const events = await repo.listAcademicCalendarEvents(tenant, input.range);
  let copied = 0;
  for (const event of events) {
    if (event.sessionId !== input.sourceSessionId || event.scope === "workspace") continue;
    const classId = event.classId ? input.classIds.get(event.classId) : null;
    const sectionId = event.sectionId ? input.sectionIds.get(event.sectionId) : null;
    if ((event.classId && !classId) || (event.sectionId && !sectionId)) continue;
    await repo.saveAcademicCalendarEvent(tenant, {
      id: randomUUID(),
      title: event.title,
      kind: event.kind,
      startOn: addIsoDays(event.startOn, input.offsetDays),
      endOn: addIsoDays(event.endOn, input.offsetDays),
      scope: event.scope,
      sessionId: input.targetSessionId,
      classId: classId ?? null,
      sectionId: sectionId ?? null,
      notes: event.notes,
      actorUserId: input.actorUserId,
    });
    copied += 1;
  }
  if (copied > 0) await broadcastCollection(ACADEMIC_CALENDAR_BROADCAST_KEY);
  return copied;
}
