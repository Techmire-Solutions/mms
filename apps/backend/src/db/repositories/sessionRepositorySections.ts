import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { SessionClassSection } from "@mms/shared";
import {
  enrollments,
  sectionStaffAssignments,
  sectionStudentRoles,
  sessionClassSections,
} from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";
import { hasSectionAttendanceTx } from "./sessionClassReferenceGuard.js";

interface ClassSectionContext {
  subdomain: string;
  sessionId: string;
  classId: string;
  /** Used for the default section when the payload carries none. */
  capacity: number;
  room: string;
}

async function assertSectionsRemovableTx(
  tx: TenantTransaction,
  subdomain: string,
  sectionIds: string[],
): Promise<void> {
  if (sectionIds.length === 0) return;
  const scope = (column: typeof enrollments.sectionId) =>
    and(sql`${column} IS NOT NULL`, inArray(column, sectionIds));
  const [enrolled] = await tx
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.workspaceSubdomain, subdomain), scope(enrollments.sectionId)))
    .limit(1);
  const [staffed] = await tx
    .select({ id: sectionStaffAssignments.id })
    .from(sectionStaffAssignments)
    .where(
      and(
        eq(sectionStaffAssignments.workspaceSubdomain, subdomain),
        inArray(sectionStaffAssignments.sectionId, sectionIds),
      ),
    )
    .limit(1);
  const [roles] = await tx
    .select({ id: sectionStudentRoles.id })
    .from(sectionStudentRoles)
    .where(
      and(
        eq(sectionStudentRoles.workspaceSubdomain, subdomain),
        inArray(sectionStudentRoles.sectionId, sectionIds),
      ),
    )
    .limit(1);
  if (enrolled || staffed || roles || (await hasSectionAttendanceTx(tx, subdomain, sectionIds))) {
    throw new ConflictError(
      "A section with enrollments, attendance or staff history cannot be removed — close it instead",
    );
  }
}

/**
 * Persists a class's sections by id. `undefined`/empty keeps stored sections and only guarantees
 * one default section ("A"). Returns the class capacity (sum of section capacities).
 */
export async function persistClassSectionsTx(
  tx: TenantTransaction,
  ctx: ClassSectionContext,
  sections: SessionClassSection[] | undefined,
): Promise<number> {
  const { subdomain, sessionId, classId } = ctx;
  const classScope = and(
    eq(sessionClassSections.workspaceSubdomain, subdomain),
    eq(sessionClassSections.classId, classId),
  );

  if (!sections || sections.length === 0) {
    const [existing] = await tx
      .select({ id: sessionClassSections.id })
      .from(sessionClassSections)
      .where(classScope)
      .limit(1);
    if (!existing) {
      await tx.insert(sessionClassSections).values({
        id: randomUUID(),
        workspaceSubdomain: subdomain,
        sessionId,
        classId,
        name: "A",
        capacity: Math.max(0, ctx.capacity),
        room: ctx.room || null,
        sortOrder: 0,
      });
    }
    return ctx.capacity;
  }

  const payload = sections.map((section) => ({
    ...section,
    id: section.id || randomUUID(),
    name: section.name.trim(),
  }));
  const names = new Set(payload.map((section) => section.name.toLowerCase()));
  if (names.size !== payload.length)
    throw new ValidationError("Section names must be unique within a class");

  const keptIds = payload.map((section) => section.id);
  const removed = await tx
    .select({ id: sessionClassSections.id })
    .from(sessionClassSections)
    .where(and(classScope, notInArray(sessionClassSections.id, keptIds)));
  const removedIds = removed.map((row) => row.id);
  await assertSectionsRemovableTx(tx, subdomain, removedIds);
  if (removedIds.length > 0) {
    await tx
      .delete(sessionClassSections)
      .where(and(classScope, inArray(sessionClassSections.id, removedIds)));
  }

  for (let index = 0; index < payload.length; index++) {
    const section = payload[index];
    const values = {
      sessionId,
      classId,
      name: section.name,
      capacity: Math.max(0, section.capacity ?? 0),
      room: section.room?.trim() || null,
      status: section.status ?? "active",
      sortOrder: index,
    };
    await tx
      .insert(sessionClassSections)
      .values({ id: section.id, workspaceSubdomain: subdomain, ...values })
      .onConflictDoUpdate({
        target: [sessionClassSections.workspaceSubdomain, sessionClassSections.id],
        set: values,
      });
  }
  return payload.reduce((total, section) => total + Math.max(0, section.capacity ?? 0), 0);
}
