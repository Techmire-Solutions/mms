import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
  WorkshopAttendanceDayBody,
  WorkshopAttendanceMark,
  WorkshopScore,
  WorkshopScoresBody,
} from "@mms/shared";
import { workshopAttendance, workshopParticipants, workshopScores } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { auditRow } from "./workshopAudit.js";
import { NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { findWorkshopRow } from "./workshopEventsRepository.js";
import { listAttendance, listScores } from "./workshopActivityRepository.js";
import { planAttendanceMarks, planScoreLines } from "./workshopUpsertPlanning.js";
import { assertWorkshopActivityEditable } from "../../workshops/domain/workshopWriteGuards.js";

async function requireParticipants(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
  participantIds: string[],
): Promise<void> {
  const workshop = await findWorkshopRow(tx, subdomain, workshopId);
  if (!workshop) throw new NotFoundError("Workshop not found");
  const unique = [...new Set(participantIds)];
  const found = await tx
    .select({ id: workshopParticipants.id })
    .from(workshopParticipants)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        inArray(workshopParticipants.id, unique),
        isNull(workshopParticipants.deletedAt),
        isNull(workshopParticipants.waitlistedAt),
      ),
    );
  if (found.length !== unique.length) {
    throw new ValidationError("Every row must name an active participant of this workshop");
  }
}

export async function saveAttendanceDay(
  tenant: string,
  workshopId: string,
  body: WorkshopAttendanceDayBody,
  markedBy: string | null,
): Promise<WorkshopAttendanceMark[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    // Same row lock as registration/trash: a check-in cannot slip in under a workshop that is
    // being archived, and two device saves serialize instead of racing the unique index.
    const workshop = await findWorkshopRow(tx, subdomain, workshopId, { forUpdate: true });
    if (!workshop) throw new NotFoundError("Workshop not found");
    assertWorkshopActivityEditable(workshop);
    const outside =
      (workshop.startDate && body.dayOn < workshop.startDate) ||
      (workshop.endDate && body.dayOn > workshop.endDate);
    if (outside) throw new ValidationError("Check-in day is outside the workshop dates");
    // De-duplicate by participant (last mark wins) and sort, so the multi-row upsert never hits
    // `21000` on a repeated row and concurrent saves take the conflict locks in the same order.
    const marks = planAttendanceMarks(body.marks);
    await requireParticipants(
      tx,
      subdomain,
      workshopId,
      marks.map((mark) => mark.participantId),
    );
    const previous = await tx
      .select({
        participantId: workshopAttendance.participantId,
        status: workshopAttendance.status,
      })
      .from(workshopAttendance)
      .where(
        and(
          eq(workshopAttendance.workspaceSubdomain, subdomain),
          eq(workshopAttendance.workshopId, workshopId),
          eq(workshopAttendance.dayOn, body.dayOn),
        ),
      );
    await tx
      .insert(workshopAttendance)
      .values(
        marks.map((mark) => ({
          id: `${mark.participantId}:${body.dayOn}`,
          workspaceSubdomain: subdomain,
          workshopId,
          participantId: mark.participantId,
          dayOn: body.dayOn,
          status: mark.status,
          markedBy,
        })),
      )
      .onConflictDoUpdate({
        target: [
          workshopAttendance.workspaceSubdomain,
          workshopAttendance.participantId,
          workshopAttendance.dayOn,
        ],
        set: {
          status: sql`excluded.status`,
          markedBy: sql`excluded.marked_by`,
          updatedAt: new Date(),
        },
      });
    await auditRow(tx, {
      workspaceSubdomain: subdomain,
      tableName: "workshop_attendance",
      recordId: `${workshopId}:${body.dayOn}`,
      actionType: previous.length > 0 ? "UPDATE" : "CREATE",
      subjectId: workshopId,
      oldState: { dayOn: body.dayOn, marks: previous },
      newState: { dayOn: body.dayOn, marks },
      minimizeDelta: false,
    });
    return listAttendance(tx, subdomain, workshopId);
  });
}

export async function saveScores(
  tenant: string,
  workshopId: string,
  body: WorkshopScoresBody,
): Promise<WorkshopScore[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const workshop = await findWorkshopRow(tx, subdomain, workshopId, { forUpdate: true });
    if (!workshop) throw new NotFoundError("Workshop not found");
    assertWorkshopActivityEditable(workshop);
    const lines = planScoreLines(body.scores);
    await requireParticipants(
      tx,
      subdomain,
      workshopId,
      lines.map((line) => line.participantId),
    );
    const previousLines = await tx
      .select({
        participantId: workshopScores.participantId,
        criterionName: workshopScores.criterionName,
        score: workshopScores.score,
        maxScore: workshopScores.maxScore,
        remarks: workshopScores.remarks,
      })
      .from(workshopScores)
      .where(
        and(
          eq(workshopScores.workspaceSubdomain, subdomain),
          eq(workshopScores.workshopId, workshopId),
        ),
      );
    await tx
      .insert(workshopScores)
      .values(
        lines.map((line) => ({
          id: crypto.randomUUID(),
          workspaceSubdomain: subdomain,
          workshopId,
          participantId: line.participantId,
          criterionName: line.criterionName,
          score: line.score.toFixed(2),
          maxScore: line.maxScore.toFixed(2),
          remarks: line.remarks ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: [
          workshopScores.workspaceSubdomain,
          workshopScores.participantId,
          workshopScores.criterionName,
        ],
        set: {
          score: sql`excluded.score`,
          maxScore: sql`excluded.max_score`,
          remarks: sql`excluded.remarks`,
          updatedAt: new Date(),
        },
      });
    await auditRow(tx, {
      workspaceSubdomain: subdomain,
      tableName: "workshop_scores",
      recordId: workshopId,
      actionType: previousLines.length > 0 ? "UPDATE" : "CREATE",
      subjectId: workshopId,
      oldState: { scores: previousLines },
      newState: { scores: lines },
      minimizeDelta: false,
    });
    return listScores(tx, subdomain, workshopId);
  });
}

/**
 * Command-centre counts. `total` is every live workshop; the date buckets only count `open`
 * workshops, and `finished` also includes explicitly completed ones — draft and cancelled
 * workshops are intentionally not "upcoming" or "ongoing" (mirrors `deriveWorkshopPhase`).
 * Events without dates count toward the total only.
 */
