import { sql } from "drizzle-orm";
import type { Enrollment } from "@mms/shared";
import type { TenantTransaction } from "../tenant-context.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";
import { enrollmentHoldsSeatSql } from "./enrollmentSeatSql.js";

type SectionRow = {
  id: string;
  sessionId: string;
  classId: string;
  status: string;
  sortOrder: number;
  capacity: number;
  enrolled: number;
};

/**
 * Server-side section placement for enrollment writes: a given section must belong to the
 * enrollment's class; otherwise the class's first active section is used. Roll numbers are
 * unique per section among live, non-cancelled enrollments.
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
    SELECT s.id, s.session_id AS "sessionId", s.class_id AS "classId", s.status,
           s.sort_order AS "sortOrder", s.capacity,
           (SELECT count(*)::int FROM enrollments en
             WHERE en.workspace_subdomain = s.workspace_subdomain AND en.section_id = s.id
               AND en.deleted_at IS NULL AND ${enrollmentHoldsSeatSql("en")}) AS enrolled
      FROM session_class_sections s
     WHERE s.workspace_subdomain = ${subdomain} AND s.class_id IN (${sql.join(
       classIds.map((id) => sql`${id}`),
       sql`, `,
     )})
     ORDER BY s.sort_order, s.name
  `);

  const resolved = records.map((record) => {
    const classSections = sections.rows.filter(
      (s) => s.classId === record.classId && s.sessionId === record.sessionId,
    );
    const requested = record.sectionId?.trim();
    if (requested) {
      if (!classSections.some((s) => s.id === requested))
        throw new ValidationError("Section does not belong to the selected class");
      return { ...record, sectionId: requested, rollNo: record.rollNo?.trim() || undefined };
    }
    // Seat-aware: the first active section that still has a free seat. A full class leaves the
    // enrollment unassigned rather than silently overfilling section A (review finding P3).
    const active = classSections.filter((section) => section.status === "active");
    const fallback = active.find(
      (section) => Number(section.enrolled ?? 0) < Math.max(0, section.capacity ?? 0),
    );
    return { ...record, sectionId: fallback?.id, rollNo: record.rollNo?.trim() || undefined };
  });

  const withRoll = resolved.filter(
    (r) => r.sectionId && r.rollNo && !r.deletedAt && r.status !== "cancelled",
  );
  const seen = new Set<string>();
  for (const record of withRoll) {
    const key = `${record.sectionId}|${record.rollNo!.toLowerCase()}`;
    if (seen.has(key))
      throw new ConflictError(`Roll number ${record.rollNo} is used twice in this section`);
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
      throw new ConflictError(
        `Roll number ${clash.rows[0].rollNo} is already used in this section`,
      );
  }
  return resolved;
}
