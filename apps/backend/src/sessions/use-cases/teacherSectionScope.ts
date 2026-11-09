import { type User } from "@mms/shared";
import { sessionsAcademicRepository as repo } from "../repository/sessionsAcademicRepositoryAdapter.js";
import type { ClassSectionDate } from "../repository/sessionsAcademicRepository.js";
import { HttpDomainError } from "../../lib/httpErrors.js";
import { userHasPermission } from "../../lib/userPermissionContext.js";

/** Users with this permission (admins, coordinators) are never section-scoped. */
const SECTION_SCOPE_BYPASS_PERMISSION = "sessions.delete" as const;

interface ClassOnDate {
  classId: string;
  /** YYYY-MM-DD business date of the record (attendance day / exam date). */
  date: string;
}

const pairKey = (entry: ClassOnDate) => `${entry.classId}|${entry.date.slice(0, 10)}`;

/**
 * Pairs the user does NOT teach on that date, or `null` when the user is not section-scoped
 * (coordinator rights, or not linked to a faculty record).
 */
async function findUntaughtPairs(
  user: User,
  tenant: string,
  entries: readonly ClassOnDate[],
): Promise<Set<string> | null> {
  if (userHasPermission(user, SECTION_SCOPE_BYPASS_PERMISSION)) return null;
  const pairs = [
    ...new Map(entries.filter((e) => e.classId && e.date).map((e) => [pairKey(e), e])).values(),
  ].map((e) => ({ classId: e.classId, onDate: e.date.slice(0, 10) }));
  const untaught = await repo.findUntaughtClassDates(tenant, user.id, pairs);
  return untaught
    ? new Set(untaught.map((row) => pairKey({ classId: row.classId, date: row.onDate })))
    : null;
}

function forbidden(): HttpDomainError {
  return new HttpDomainError(
    403,
    "forbidden",
    "You can only record entries for classes you teach on that date",
  );
}

/**
 * Standard teacher row-scope: a faculty-linked user without coordinator rights may only mark
 * attendance for classes where they teach on that date — an active section staff assignment
 * (any role, incl. assistant) or a timetable period (primary or assistant teacher).
 */
export async function assertTeacherClassScope(
  user: User,
  tenant: string,
  entries: readonly ClassOnDate[],
): Promise<void> {
  if (entries.length === 0) return;
  const untaught = await findUntaughtPairs(user, tenant, entries);
  if (untaught && untaught.size > 0) throw forbidden();
}

/**
 * Section-level row-scope for attendance marks.
 *
 * A teacher is staffed on a **section**, not a whole class. The class-level check is still applied
 * (it also covers unsectioned classes and timetable-only assignments are not evidence for a specific
 * section), then every sectioned row must be an active assignment for that exact section on that
 * date. A mark whose section is null keeps the class-level rule.
 */
export async function assertTeacherSectionScope(
  user: User,
  tenant: string,
  entries: readonly ClassSectionDate[],
): Promise<void> {
  if (entries.length === 0) return;
  if (userHasPermission(user, SECTION_SCOPE_BYPASS_PERMISSION)) return;
  await assertTeacherClassScope(
    user,
    tenant,
    entries.map((entry) => ({ classId: entry.classId, date: entry.onDate })),
  );
  const sectioned = entries.filter((entry) => entry.sectionId);
  if (sectioned.length === 0) return;
  const unstaffed = await repo.findUnstaffedSectionDates(tenant, user.id, sectioned);
  if (unstaffed && unstaffed.length > 0) {
    throw new HttpDomainError(
      403,
      "forbidden",
      "You can only record attendance for the sections you are assigned to on that date",
    );
  }
}

/** Each group passes when the user teaches at least one of its classes (e.g. an exam held for several classes). */
export async function assertTeacherAnyClassScope(
  user: User,
  tenant: string,
  groups: readonly (readonly ClassOnDate[])[],
): Promise<void> {
  const nonEmpty = groups.filter((group) => group.length > 0);
  if (nonEmpty.length === 0) return;
  const untaught = await findUntaughtPairs(user, tenant, nonEmpty.flat());
  if (untaught && nonEmpty.some((group) => group.every((entry) => untaught.has(pairKey(entry)))))
    throw forbidden();
}
