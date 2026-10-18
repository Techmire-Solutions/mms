import { roleHasPermission, type User } from "@mms/shared";
import { sessionsAcademicRepository as repo } from "../repository/sessionsAcademicRepositoryAdapter.js";
import { HttpDomainError } from "../../lib/httpErrors.js";

/** Users with this permission (admins, coordinators) are never section-scoped. */
export const SECTION_SCOPE_BYPASS_PERMISSION = "sessions.delete" as const;

export interface ClassOnDate {
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
  if (roleHasPermission(user.role, SECTION_SCOPE_BYPASS_PERMISSION)) return null;
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
