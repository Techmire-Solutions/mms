import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { enrollments, sessionClassSections, sessions } from "../schema.js";
import { isSessionReadOnly } from "@mms/shared";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { insertTypedTimelineEventTx, movePlacementTx } from "./enrollmentHistoryWrite.js";
import { enrollmentHoldsSeatWhere } from "./enrollmentSeatSql.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";

interface SectionActor {
  userId: string | null;
  label: string;
}

interface SectionRef {
  id: string;
  sessionId: string;
  classId: string;
  name: string;
  capacity: number;
  status: string;
}

const sectionKey = (subdomain: string, id: string) =>
  and(eq(sessionClassSections.workspaceSubdomain, subdomain), eq(sessionClassSections.id, id));

/** Section with the ids of its live (seat-holding) enrollments. */
export async function loadSectionRoster(
  tenant: string,
  sectionId: string,
): Promise<{ section: SectionRef; enrollmentIds: string[] } | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [section] = await tx
      .select({
        id: sessionClassSections.id,
        sessionId: sessionClassSections.sessionId,
        classId: sessionClassSections.classId,
        name: sessionClassSections.name,
        capacity: sessionClassSections.capacity,
        status: sessionClassSections.status,
      })
      .from(sessionClassSections)
      .where(sectionKey(subdomain, sectionId));
    if (!section) return null;
    return { section, enrollmentIds: await liveEnrollmentIdsTx(tx, subdomain, sectionId) };
  });
}

async function liveEnrollmentIdsTx(
  tx: TenantTransaction,
  subdomain: string,
  sectionId: string,
): Promise<string[]> {
  const rows = await tx
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.workspaceSubdomain, subdomain),
        eq(enrollments.sectionId, sectionId),
        isNull(enrollments.deletedAt),
        enrollmentHoldsSeatWhere(),
      ),
    );
  return rows.map((row) => row.id);
}

async function moveToSectionTx(
  tx: TenantTransaction,
  subdomain: string,
  move: {
    enrollmentIds: readonly string[];
    from: SectionRef;
    to: { id: string; classId: string; name: string };
    effectiveOn: string;
    reason: string;
    actor: SectionActor;
  },
): Promise<void> {
  if (move.enrollmentIds.length === 0) return;
  await tx
    .update(enrollments)
    .set({ sectionId: move.to.id, rollNo: null, updatedAt: new Date() })
    .where(
      and(
        eq(enrollments.workspaceSubdomain, subdomain),
        inArray(enrollments.id, [...move.enrollmentIds]),
      ),
    );
  for (const enrollmentId of move.enrollmentIds) {
    await movePlacementTx(tx, subdomain, {
      enrollmentId,
      classId: move.to.classId,
      sectionId: move.to.id,
      effectiveOn: move.effectiveOn,
      reason: move.reason,
      actorUserId: move.actor.userId,
    });
    await insertTypedTimelineEventTx(tx, subdomain, {
      enrollmentId,
      eventType: "transferred",
      event: `Moved from section ${move.from.name} to ${move.to.name}`,
      actorUserId: move.actor.userId,
      actorLabel: move.actor.label,
      effectiveOn: move.effectiveOn,
      reason: move.reason,
      fromClassId: move.from.classId,
      toClassId: move.to.classId,
      fromSectionId: move.from.id,
      toSectionId: move.to.id,
    });
  }
}

async function closeSectionTx(
  tx: TenantTransaction,
  subdomain: string,
  sectionId: string,
  closedOn: string,
  reason: string,
): Promise<void> {
  await tx
    .update(sessionClassSections)
    .set({ status: "closed", closedOn, closedReason: reason, updatedAt: new Date() })
    .where(sectionKey(subdomain, sectionId));
}

const lockSections = (tx: TenantTransaction, subdomain: string, ids: readonly string[]) =>
  tx.execute(sql`SELECT id FROM session_class_sections
    WHERE workspace_subdomain = ${subdomain} AND id IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )}) FOR UPDATE`);

/**
 * Re-reads the section and its session *after* the row lock. The use case checked these before
 * opening the transaction, but a concurrent close/start between then and the lock must not be
 * allowed to move students into a closed section.
 */
async function assertSectionWritableTx(
  tx: TenantTransaction,
  subdomain: string,
  sectionId: string,
  expectedClassId?: string,
) {
  const [row] = await tx
    .select({
      id: sessionClassSections.id,
      classId: sessionClassSections.classId,
      status: sessionClassSections.status,
      capacity: sessionClassSections.capacity,
      sessionStatus: sessions.status,
    })
    .from(sessionClassSections)
    .innerJoin(
      sessions,
      and(
        eq(sessions.workspaceSubdomain, sessionClassSections.workspaceSubdomain),
        eq(sessions.id, sessionClassSections.sessionId),
      ),
    )
    .where(sectionKey(subdomain, sectionId));
  if (!row) throw new NotFoundError("Section not found");
  if (expectedClassId && row.classId !== expectedClassId)
    throw new ConflictError("The target must be another section of the same class");
  if (row.status !== "active") throw new ConflictError("The section is already closed");
  if (isSessionReadOnly(row.sessionStatus))
    throw new ConflictError("The session is closed; its sections are read-only");
  return row;
}

/** Moves every live student of `source` into `target` on a date and closes `source`. */
export async function applySectionMerge(
  tenant: string,
  input: {
    source: SectionRef;
    target: SectionRef;
    effectiveOn: string;
    reason: string;
    actor: SectionActor;
  },
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await lockSections(tx, subdomain, [input.source.id, input.target.id]);
    const targetRow = await assertSectionWritableTx(
      tx,
      subdomain,
      input.target.id,
      input.source.classId,
    );
    await assertSectionWritableTx(tx, subdomain, input.source.id, input.source.classId);
    const enrollmentIds = await liveEnrollmentIdsTx(tx, subdomain, input.source.id);
    const targetLive = await liveEnrollmentIdsTx(tx, subdomain, input.target.id);
    if (targetRow.capacity > 0 && targetLive.length + enrollmentIds.length > targetRow.capacity)
      throw new ConflictError(
        `${input.target.name} does not have enough seats left; raise its capacity first`,
      );
    await moveToSectionTx(tx, subdomain, {
      ...input,
      enrollmentIds,
      from: input.source,
      to: input.target,
    });
    await closeSectionTx(tx, subdomain, input.source.id, input.effectiveOn, input.reason);
    return enrollmentIds.length;
  });
}

/** Creates a section in the same class and moves the chosen students into it. */
export async function applySectionSplit(
  tenant: string,
  input: {
    source: SectionRef;
    name: string;
    capacity: number;
    enrollmentIds: readonly string[];
    effectiveOn: string;
    reason: string;
    actor: SectionActor;
  },
): Promise<string> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await lockSections(tx, subdomain, [input.source.id]);
    await assertSectionWritableTx(tx, subdomain, input.source.id, input.source.classId);
    const live = new Set(await liveEnrollmentIdsTx(tx, subdomain, input.source.id));
    if (input.enrollmentIds.some((id) => !live.has(id)))
      throw new ConflictError("A selected student is no longer in this section");
    if (input.enrollmentIds.length > input.capacity)
      throw new ValidationError("The new section's capacity is smaller than the students moved");
    const [{ next }] = (
      await tx.execute<{ next: number }>(sql`
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM session_class_sections
         WHERE workspace_subdomain = ${subdomain} AND class_id = ${input.source.classId}`)
    ).rows;
    const id = randomUUID();
    await tx.insert(sessionClassSections).values({
      id,
      workspaceSubdomain: subdomain,
      sessionId: input.source.sessionId,
      classId: input.source.classId,
      name: input.name,
      capacity: input.capacity,
      status: "active",
      sortOrder: Number(next),
    });
    await moveToSectionTx(tx, subdomain, {
      ...input,
      from: input.source,
      to: { id, classId: input.source.classId, name: input.name },
    });
    return id;
  });
}

/** Closes a section that has no live students (re-checked under lock). */
export async function applySectionClose(
  tenant: string,
  input: { sectionId: string; effectiveOn: string; reason: string },
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await lockSections(tx, subdomain, [input.sectionId]);
    await assertSectionWritableTx(tx, subdomain, input.sectionId);
    const live = await liveEnrollmentIdsTx(tx, subdomain, input.sectionId);
    if (live.length > 0) return live.length;
    await closeSectionTx(tx, subdomain, input.sectionId, input.effectiveOn, input.reason);
    return 0;
  });
}
