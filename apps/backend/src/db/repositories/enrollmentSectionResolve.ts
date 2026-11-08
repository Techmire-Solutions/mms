import { sql } from "drizzle-orm";
import { enrollmentHoldsSeat, type Enrollment } from "@mms/shared";
import type { TenantTransaction } from "../tenant-context.js";
import {
  RollNumberConflictError,
  SeatCapacityError,
  ValidationError,
} from "../../lib/httpErrors.js";
import { enrollmentHoldsSeatSql } from "./enrollmentSeatSql.js";
import {
  countLiveSeatsBySectionTx,
  loadEnrollmentSeatHoldersTx,
  lockSectionsForSeatsTx,
  type LockedSeatSection,
} from "./enrollmentSeatCountRepository.js";

type SectionRow = {
  id: string;
  sessionId: string;
  classId: string;
  name: string;
  status: string;
  sortOrder: number;
  capacity: number;
};

/** Whether this record will occupy a seat once written. */
function recordHoldsSeat(record: Enrollment): boolean {
  return !record.deletedAt && enrollmentHoldsSeat(String(record.status || "pending"));
}

/**
 * Server-side section placement for enrollment writes.
 *
 * Seat accounting is the important part: the candidate sections are row-locked (in id
 * order) **before** the live counts are taken, so two concurrent writes cannot both
 * take the last free seat. The pre-lock query below is only used to validate the
 * requested section and to know which classes/sections to lock — never to grant a seat.
 *
 * A record that already occupies its current section allocates nothing (that is what
 * makes editing notes/fees of a student in a full section possible); a move or a new
 * row must find a free seat or the write is refused with `SeatCapacityError`.
 */
export async function resolveEnrollmentSectionsTx(
  tx: TenantTransaction,
  subdomain: string,
  records: Enrollment[],
): Promise<Enrollment[]> {
  const classIds = [
    ...new Set(records.map((record) => String(record.classId || "")).filter(Boolean)),
  ];
  if (classIds.length === 0) return records;

  const sections = await tx.execute<SectionRow>(sql`
    SELECT s.id, s.session_id AS "sessionId", s.class_id AS "classId", s.name, s.status,
           s.sort_order AS "sortOrder", s.capacity
      FROM session_class_sections s
     WHERE s.workspace_subdomain = ${subdomain}
       AND s.class_id IN (${sql.join(
         classIds.map((id) => sql`${id}`),
         sql`, `,
       )})
     ORDER BY s.sort_order, s.name
  `);
  const byClassAndSession = (record: Enrollment): SectionRow[] =>
    sections.rows.filter(
      (section) => section.classId === record.classId && section.sessionId === record.sessionId,
    );

  // Every section a record names, plus every active section of the classes involved
  // (auto-placement must be able to fall through to another section under the lock).
  const candidateIds = new Set<string>();
  for (const record of records) {
    const classSections = byClassAndSession(record);
    for (const section of classSections)
      if (section.status === "active") candidateIds.add(section.id);
    const requested = record.sectionId?.trim();
    if (requested) candidateIds.add(requested);
  }
  const locked = await lockSectionsForSeatsTx(tx, subdomain, [...candidateIds]);
  const holders = await loadEnrollmentSeatHoldersTx(
    tx,
    subdomain,
    records.map((record) => String(record.id)),
  );
  // Count once under the lock; the map is then incremented as seats are granted, so a
  // batch cannot hand the same seat to two of its own records. Nothing is excluded: a
  // record that keeps its current seat bypasses the check below, and a moving/new record
  // is not counted in its target section anyway (its own row still points at the old one).
  const occupied = await countLiveSeatsBySectionTx(tx, subdomain, [...candidateIds]);

  const liveSections = (record: Enrollment): LockedSeatSection[] =>
    byClassAndSession(record)
      .map((section) => locked.get(section.id))
      .filter((section): section is LockedSeatSection => Boolean(section))
      .sort((a, b) => a.id.localeCompare(b.id));

  const takeSeat = (section: LockedSeatSection): void => {
    const capacity = Math.max(0, section.capacity ?? 0);
    const used = occupied.get(section.id) ?? 0;
    // 0 = no cap: the seat is granted and simply not counted against the section.
    if (capacity > 0 && used >= capacity) {
      throw new SeatCapacityError(
        `${section.name || "The section"} is full`,
        section.id,
        Math.max(0, Math.max(0, section.capacity ?? 0) - used),
      );
    }
    occupied.set(section.id, used + 1);
  };

  const resolved = records.map((record) => {
    const classSections = byClassAndSession(record);
    const requested = record.sectionId?.trim();
    const holder = holders.get(String(record.id));
    // A row that already occupied this section does not allocate a second seat; a row
    // that was withdrawn/cancelled (or is new) does, even when the section is unchanged.
    const previouslyHeldSeat = Boolean(
      holder && !holder.deleted && enrollmentHoldsSeat(String(holder.status)),
    );

    if (requested) {
      const section = classSections.find((candidate) => candidate.id === requested);
      if (!section) throw new ValidationError("Section does not belong to the selected class");
      if (section.status !== "active")
        throw new ValidationError("A closed section cannot take enrollments");
      const keepsSeat = previouslyHeldSeat && holder?.sectionId === requested;
      if (recordHoldsSeat(record) && !keepsSeat) {
        const lockedSection = locked.get(requested);
        if (!lockedSection)
          throw new SeatCapacityError("The section is no longer available", requested);
        takeSeat(lockedSection);
      }
      return { ...record, sectionId: requested, rollNo: record.rollNo?.trim() || undefined };
    }

    // A class with no sections is still valid legacy data (pre-0167 rows): there is no
    // section to place into and capacity is the class-level `maxStudents`, which the
    // callers already check. Leave the record exactly as supplied.
    if (classSections.length === 0) {
      return { ...record, sectionId: undefined, rollNo: record.rollNo?.trim() || undefined };
    }

    const active = liveSections(record).filter((section) => section.status === "active");
    const keepsCurrent = active.find((section) => section.id === holder?.sectionId);
    if (keepsCurrent && previouslyHeldSeat) {
      return { ...record, sectionId: keepsCurrent.id, rollNo: record.rollNo?.trim() || undefined };
    }
    // A released/archived row holds no seat: place it for the record's own sake but do
    // not let a full class block a status change.
    if (!recordHoldsSeat(record)) {
      const fallback = keepsCurrent ?? active[0] ?? liveSections(record)[0];
      return {
        ...record,
        sectionId: fallback?.id,
        rollNo: record.rollNo?.trim() || undefined,
      };
    }
    const hasRoom = (section: LockedSeatSection): boolean => {
      const capacity = Math.max(0, section.capacity ?? 0);
      return capacity === 0 || (occupied.get(section.id) ?? 0) < capacity;
    };
    const free = keepsCurrent && hasRoom(keepsCurrent) ? keepsCurrent : active.find(hasRoom);
    if (!free) {
      const className = record.className || "The class";
      throw new SeatCapacityError(`${className} is full`, undefined, 0);
    }
    takeSeat(free);
    return { ...record, sectionId: free.id, rollNo: record.rollNo?.trim() || undefined };
  });

  const withRoll = resolved.filter(
    (r) => r.sectionId && r.rollNo && !r.deletedAt && r.status !== "cancelled",
  );
  const seen = new Set<string>();
  for (const record of withRoll) {
    const key = `${record.sectionId}|${record.rollNo!.toLowerCase()}`;
    if (seen.has(key))
      throw new RollNumberConflictError(
        `Roll number ${record.rollNo} is used twice in this section`,
      );
    seen.add(key);
  }
  if (withRoll.length > 0) {
    const clash = await tx.execute<{ rollNo: string }>(sql`
      SELECT e.roll_no AS "rollNo" FROM enrollments e
        JOIN (VALUES ${sql.join(
          withRoll.map(
            (r) => sql`(${String(r.id)}::text, ${r.sectionId!}::text, ${r.rollNo!}::text)`,
          ),
          sql`, `,
        )})
          AS v(id, section_id, roll_no)
          ON e.section_id = v.section_id AND lower(btrim(e.roll_no)) = lower(btrim(v.roll_no)) AND e.id <> v.id
       WHERE e.workspace_subdomain = ${subdomain} AND e.deleted_at IS NULL AND ${enrollmentHoldsSeatSql("e")}
       LIMIT 1
    `);
    if (clash.rows[0])
      throw new RollNumberConflictError(
        `Roll number ${clash.rows[0].rollNo} is already used in this section`,
      );
  }
  return resolved;
}
