import { randomUUID } from "node:crypto";
import { addIsoDays, type Enrollment, type EnrollmentEventType } from "@mms/shared";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { enrollmentPlacements, enrollmentTimelineEvents } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";

type Placeable = Pick<
  Enrollment,
  "id" | "classId" | "sectionId" | "enrolledDate" | "startOn" | "deletedAt"
>;

export interface TypedTimelineEvent {
  enrollmentId: string;
  eventType: EnrollmentEventType;
  event: string;
  actorUserId: string | null;
  actorLabel: string;
  effectiveOn: string;
  reason?: string | null;
  fromClassId?: string | null;
  toClassId?: string | null;
  fromSectionId?: string | null;
  toSectionId?: string | null;
}

/**
 * Client timeline writes are append-only: items that already carry a stored `id` are skipped, so
 * server-written events and history are never deleted or rewritten by a save.
 */
export async function appendClientTimelineTx(
  tx: TenantTransaction,
  subdomain: string,
  records: readonly Pick<Enrollment, "id" | "timeline">[],
): Promise<void> {
  const rows = records.flatMap((record) =>
    (record.timeline ?? [])
      .filter((item) => item.id === undefined)
      .map((item) => ({
        workspaceSubdomain: subdomain,
        enrollmentId: String(record.id),
        event: item.event,
        by: item.by,
        ts: item.ts,
      })),
  );
  if (rows.length > 0) await tx.insert(enrollmentTimelineEvents).values(rows);
}

export async function insertTypedTimelineEventTx(
  tx: TenantTransaction,
  subdomain: string,
  event: TypedTimelineEvent,
): Promise<void> {
  const now = new Date();
  await tx.insert(enrollmentTimelineEvents).values({
    workspaceSubdomain: subdomain,
    enrollmentId: event.enrollmentId,
    event: event.event,
    by: event.actorLabel,
    ts: now.toISOString(),
    eventType: event.eventType,
    occurredAt: now,
    effectiveOn: event.effectiveOn,
    actorUserId: event.actorUserId,
    reason: event.reason ?? null,
    fromClassId: event.fromClassId ?? null,
    toClassId: event.toClassId ?? null,
    fromSectionId: event.fromSectionId ?? null,
    toSectionId: event.toSectionId ?? null,
  });
}

/**
 * Ends the open placement the day before `effectiveOn` and opens a new one from `effectiveOn`.
 * A same-day (or back-dated before the open row's start) change corrects the open row in place.
 */
export async function movePlacementTx(
  tx: TenantTransaction,
  subdomain: string,
  move: {
    enrollmentId: string;
    classId: string;
    sectionId: string | null;
    effectiveOn: string;
    reason: string;
    actorUserId: string | null;
  },
): Promise<void> {
  const [open] = await tx
    .select({ id: enrollmentPlacements.id, startOn: enrollmentPlacements.startOn })
    .from(enrollmentPlacements)
    .where(
      and(
        eq(enrollmentPlacements.workspaceSubdomain, subdomain),
        eq(enrollmentPlacements.enrollmentId, move.enrollmentId),
        isNull(enrollmentPlacements.endOn),
      ),
    )
    .for("update");
  if (open && open.startOn >= move.effectiveOn) {
    await tx
      .update(enrollmentPlacements)
      .set({ classId: move.classId, sectionId: move.sectionId, reason: move.reason })
      .where(
        and(
          eq(enrollmentPlacements.workspaceSubdomain, subdomain),
          eq(enrollmentPlacements.id, open.id),
        ),
      );
    return;
  }
  if (open) await closePlacementTx(tx, subdomain, open.id, addIsoDays(move.effectiveOn, -1));
  await tx.insert(enrollmentPlacements).values({
    id: randomUUID(),
    workspaceSubdomain: subdomain,
    enrollmentId: move.enrollmentId,
    classId: move.classId,
    sectionId: move.sectionId,
    startOn: move.effectiveOn,
    reason: move.reason,
    createdBy: move.actorUserId,
  });
}

export async function closePlacementTx(
  tx: TenantTransaction,
  subdomain: string,
  placementId: string,
  endOn: string,
): Promise<void> {
  await tx
    .update(enrollmentPlacements)
    .set({ endOn })
    .where(
      and(
        eq(enrollmentPlacements.workspaceSubdomain, subdomain),
        eq(enrollmentPlacements.id, placementId),
      ),
    );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const firstIsoDate = (...values: (string | null | undefined)[]) =>
  values.find((value): value is string => Boolean(value && ISO_DATE.test(value)));

/**
 * Keeps the open placement in step with generic saves: creates it for enrollments without history
 * and moves it (effective `today`) when a save changed the class or section.
 */
export async function syncPlacementsTx(
  tx: TenantTransaction,
  subdomain: string,
  records: readonly Placeable[],
  today: string,
  actorUserId: string | null = null,
): Promise<void> {
  const live = records.filter((record) => !record.deletedAt && record.classId);
  if (live.length === 0) return;
  const placements = await tx
    .select({
      enrollmentId: enrollmentPlacements.enrollmentId,
      classId: enrollmentPlacements.classId,
      sectionId: enrollmentPlacements.sectionId,
      endOn: enrollmentPlacements.endOn,
    })
    .from(enrollmentPlacements)
    .where(
      and(
        eq(enrollmentPlacements.workspaceSubdomain, subdomain),
        inArray(
          enrollmentPlacements.enrollmentId,
          live.map((record) => String(record.id)),
        ),
      ),
    );
  const openBy = new Map(
    placements.filter((row) => row.endOn === null).map((row) => [row.enrollmentId, row]),
  );
  const placed = new Set(placements.map((row) => row.enrollmentId));
  for (const record of live) {
    const current = openBy.get(String(record.id));
    // Every placement closed = the enrollment has ended (withdrawn); a save never reopens it.
    if (!current && placed.has(String(record.id))) continue;
    const sectionId = record.sectionId ?? null;
    if (current && current.classId === record.classId && current.sectionId === sectionId) continue;
    await movePlacementTx(tx, subdomain, {
      enrollmentId: String(record.id),
      classId: record.classId,
      sectionId,
      effectiveOn: current ? today : (firstIsoDate(record.startOn, record.enrolledDate) ?? today),
      reason: current ? "Changed by enrollment edit" : "Enrolled",
      actorUserId,
    });
  }
}
