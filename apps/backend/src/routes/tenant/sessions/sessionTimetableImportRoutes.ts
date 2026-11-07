import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import {
  SESSIONS_MODULE_MANIFEST,
  sessionTimetableImportBodySchema,
  type Class,
  type Session,
} from "@mms/shared";
import { canWriteCollection } from "../../../services/rbacService.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";
import { sessionsUseCases } from "../../../sessions/use-cases/sessionsUseCases.js";

const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;
const MAX_ROWS = 500;

function stableId(sessionId: string, rowIndex: number, suffix: string): string {
  return createHash("sha256")
    .update(`${sessionId}:${rowIndex}:${suffix}`)
    .digest("hex")
    .slice(0, 24);
}

function resolveClass(
  session: Session,
  row: { classId?: string; className?: string },
): Class | null {
  return (
    session.classes?.find(
      (cls) =>
        (row.classId && cls.id === row.classId) ||
        (!row.classId &&
          row.className &&
          cls.name.trim().toLowerCase() === row.className.toLowerCase()),
    ) ?? null
  );
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Bulk class-timetable import. Validated synchronously (max 500 rows) for immediate per-row
 * errors; deterministic ids make a retried request idempotent. Rows are persisted through the
 * normal session update path so audit, overlap checks and child-table integrity stay intact.
 */
export const sessionTimetableImportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/:id/timetable/import", async (request, reply) => {
    const user = request.user as { id?: string } | undefined;
    if (!user || !canWriteCollection(user as never, COLLECTION))
      return reply.status(403).send({ type: "forbidden", message: "Insufficient permissions" });
    if (!userHasPermission(user as never, SESSIONS_MODULE_MANIFEST.permissions.manage))
      return reply.status(403).send({ type: "forbidden", message: "Insufficient permissions" });
    const parsed = sessionTimetableImportBodySchema.safeParse(request.body);
    if (!parsed.success)
      return reply.status(400).send({
        type: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid rows",
      });
    if (parsed.data.rows.length > MAX_ROWS)
      return reply
        .status(400)
        .send({ type: "validation_error", message: `At most ${MAX_ROWS} rows` });

    const { id } = request.params as { id: string };
    const [session] = await sessionsUseCases.loadSessionsByIds([id]);
    if (!session)
      return reply.status(404).send({ type: "not_found", message: "Session not found" });

    const classes: Class[] = (session.classes ?? []).map((cls) => ({
      ...cls,
      timetables: (cls.timetables ?? []).map((tt) => ({ ...tt, periods: [...(tt.periods ?? [])] })),
    }));
    const errors: Array<{ row: number; reason: string }> = [];
    let imported = 0;

    for (let index = 0; index < parsed.data.rows.length; index += 1) {
      const row = parsed.data.rows[index];
      const rowNumber = index + 1;
      const fail = (reason: string) => errors.push({ row: rowNumber, reason });
      if (
        !row.date ||
        (session.startDate && row.date < session.startDate) ||
        (session.endDate && row.date > session.endDate)
      ) {
        fail("Date is outside the session range");
        continue;
      }
      if (row.startTime >= row.endTime) {
        fail("startTime must be before endTime");
        continue;
      }
      if (!row.subjectId) {
        fail("subjectId is required (period subjects are stored from the catalog)");
        continue;
      }
      const cls = resolveClass({ ...session, classes }, row);
      if (!cls) {
        fail("Class not found in this session");
        continue;
      }
      if (row.sectionId || row.sectionName) {
        const section = cls.sections?.find(
          (item) =>
            (row.sectionId && item.id === row.sectionId) ||
            (!row.sectionId &&
              row.sectionName &&
              item.name.toLowerCase() === row.sectionName.toLowerCase()),
        );
        if (!section) {
          fail("Section not found in this class");
          continue;
        }
      }
      const dayPeriods =
        cls.timetables?.filter((tt) => tt.date === row.date).flatMap((tt) => tt.periods ?? []) ??
        [];
      if (
        dayPeriods.some((period) =>
          overlaps(row.startTime, row.endTime, period.startTime, period.endTime),
        )
      ) {
        fail("Time overlaps an existing period");
        continue;
      }
      const timetableId = stableId(session.id, 0, `${cls.id}:${row.date}`);
      let timetable = cls.timetables?.find((tt) => tt.date === row.date);
      if (!timetable) {
        timetable = { id: timetableId, classId: cls.id, date: row.date, periods: [] };
        cls.timetables = [...(cls.timetables ?? []), timetable];
      }
      const duplicate = timetable.periods.some(
        (period) =>
          period.startTime === row.startTime &&
          period.endTime === row.endTime &&
          period.subject === row.subject,
      );
      if (duplicate) {
        imported += 1; // Idempotent retry; already present.
        continue;
      }
      timetable.periods.push({
        id: `per-${stableId(session.id, index, `${cls.id}:${row.date}:${row.startTime}`)}`,
        timetableId: timetable.id,
        startTime: row.startTime,
        endTime: row.endTime,
        subject: row.subject,
        subjectId: row.subjectId || undefined,
        facultyId: row.facultyId || "",
        facultyName: row.facultyName || cls.facultyName || "",
      });
      imported += 1;
    }

    if (parsed.data.dryRun) {
      return reply.status(200).send({ dryRun: true, imported, failed: errors.length, errors });
    }
    if (imported === 0) {
      return reply.status(200).send({ imported: 0, failed: errors.length, errors });
    }

    const updated = await sessionsUseCases.updateSessionById(
      session.id,
      { classes },
      { canOverrideLock: true, lockOverrideReason: "Timetable import" },
      session.updatedAt,
      session.version,
    );
    if (!updated)
      return reply.status(404).send({ type: "not_found", message: "Session not found" });
    return reply.status(200).send({
      imported,
      failed: errors.length,
      total: parsed.data.rows.length,
      errors,
    });
  });
};
