import {
  academicCalendarEventWriteSchema,
  type AcademicCalendarEvent,
  type AcademicCalendarEventWrite,
} from "@mms/shared";
import { attendanceCalendarRepository as repo } from "../repository/attendanceCalendarRepositoryAdapter.js";
import type { AcademicCalendarRange } from "../repository/attendanceCalendarRepository.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { ValidationError } from "../../lib/httpErrors.js";
import { isForeignKeyViolation } from "../../lib/pgErrors.js";

/** Live-push key: the frontend invalidates calendar + attendance metric queries. */
export const ACADEMIC_CALENDAR_BROADCAST_KEY = "academic_calendar";

export function createAcademicCalendarUseCases() {
  return {
    list(tenant: string, range: AcademicCalendarRange): Promise<AcademicCalendarEvent[]> {
      return repo.listAcademicCalendarEvents(tenant, range);
    },

    async save(
      tenant: string,
      id: string,
      body: AcademicCalendarEventWrite,
      actorUserId: string,
    ): Promise<AcademicCalendarEvent> {
      const parsed = academicCalendarEventWriteSchema.parse(body);
      try {
        const item = await repo.saveAcademicCalendarEvent(tenant, { id, ...parsed, actorUserId });
        await broadcastCollection(ACADEMIC_CALENDAR_BROADCAST_KEY);
        return item;
      } catch (error) {
        if (isForeignKeyViolation(error))
          throw new ValidationError("The selected session, class or section does not exist");
        throw error;
      }
    },

    async remove(tenant: string, id: string, actorUserId: string): Promise<boolean> {
      const removed = await repo.softDeleteAcademicCalendarEvent(tenant, id, actorUserId);
      if (removed) await broadcastCollection(ACADEMIC_CALENDAR_BROADCAST_KEY);
      return removed;
    },

    async restore(
      tenant: string,
      id: string,
      actorUserId: string,
    ): Promise<AcademicCalendarEvent | null> {
      const item = await repo.restoreAcademicCalendarEvent(tenant, id, actorUserId);
      if (item) await broadcastCollection(ACADEMIC_CALENDAR_BROADCAST_KEY);
      return item;
    },
  };
}

export const academicCalendarUseCases = createAcademicCalendarUseCases();
