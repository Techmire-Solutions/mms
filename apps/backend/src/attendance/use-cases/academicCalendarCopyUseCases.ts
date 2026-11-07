import { randomUUID } from "node:crypto";
import { addIsoDays } from "@mms/shared";
import { attendanceCalendarRepository as repo } from "../repository/attendanceCalendarRepositoryAdapter.js";
import { withTenant } from "../../db/tenant-context.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { ACADEMIC_CALENDAR_BROADCAST_KEY } from "./academicCalendarUseCases.js";

export interface CalendarCopyOptions {
  /** Deterministic event id for a retried rollover (idempotent upsert). */
  idFor?: (sourceEventId: string) => string;
  /** Reports a class/section-mapped event that could not be copied instead of dropping it. */
  onSkip?: (info: { sourceEventId: string; reason: string }) => Promise<void>;
}

/**
 * Copies the session/class/section calendar events of `sourceSessionId` into `targetSessionId`,
 * shifted by `offsetDays`. Runs inside one transaction (all-or-nothing) and uses deterministic ids
 * when supplied, so a retried rollover neither duplicates nor half-copies events (findings R1/R11).
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
  options: CalendarCopyOptions = {},
): Promise<number> {
  return withTenant(tenant, async () => {
    const events = await repo.listAcademicCalendarEvents(tenant, input.range);
    let copied = 0;
    for (const event of events) {
      if (event.sessionId !== input.sourceSessionId || event.scope === "workspace") continue;
      const classId = event.classId ? input.classIds.get(event.classId) : null;
      const sectionId = event.sectionId ? input.sectionIds.get(event.sectionId) : null;
      if ((event.classId && !classId) || (event.sectionId && !sectionId)) {
        await options.onSkip?.({
          sourceEventId: event.id,
          reason: `Calendar event "${event.title}" references a class/section that was not copied`,
        });
        continue;
      }
      await repo.saveAcademicCalendarEvent(tenant, {
        id: options.idFor?.(event.id) ?? randomUUID(),
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
  });
}
