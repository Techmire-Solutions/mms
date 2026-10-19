import { and, eq, inArray } from "drizzle-orm";
import type { AcademicCalendarEvent, WeekdayName } from "@mms/shared";
import { sessionClasses } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { listCalendarEventsTx } from "./academicCalendarRepository.js";
import { listEnrollmentPlacementsTx } from "./enrollmentPlacementLookup.js";
import { loadSessionWorkingDaysTx } from "./sessionWorkingDays.js";

export interface InstructionalDayContext {
  /** Class id → owning session id (legacy rows may carry a session id in `class_id`). */
  sessionOf: Map<string, string>;
  /** Session id → working-day override (empty / missing = workspace default). */
  sessionDays: Map<string, WeekdayName[]>;
  /** `${studentId}:${classId}` → section id of the student's enrollment. */
  sectionOf: Map<string, string | null>;
  events: AcademicCalendarEvent[];
}

/** Everything needed to decide teaching days for attendance rows, read in one snapshot. */
export async function loadInstructionalDayContext(
  tenant: string,
  input: { classIds: string[]; studentIds: string[]; from: string; to: string },
): Promise<InstructionalDayContext> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const classRows = await tx
      .select({ id: sessionClasses.id, sessionId: sessionClasses.sessionId })
      .from(sessionClasses)
      .where(
        and(
          eq(sessionClasses.workspaceSubdomain, subdomain),
          inArray(sessionClasses.id, input.classIds),
        ),
      );
    const sessionOf = new Map<string, string>(input.classIds.map((id) => [id, id]));
    for (const row of classRows) sessionOf.set(row.id, row.sessionId);
    const sessionDays = await loadSessionWorkingDaysTx(tx, subdomain, [
      ...new Set(sessionOf.values()),
    ]);
    const placements = await listEnrollmentPlacementsTx(
      tx,
      subdomain,
      input.classIds,
      input.studentIds,
    );
    const sectionOf = new Map(
      placements.map((row) => [`${row.studentId}:${row.classId}`, row.sectionId]),
    );
    const events = await listCalendarEventsTx(tx, subdomain, { from: input.from, to: input.to });
    return { sessionOf, sessionDays, sectionOf, events };
  });
}
