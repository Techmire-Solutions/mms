import { and, asc, eq, gte, isNotNull, isNull, lte } from "drizzle-orm";
import type {
  AcademicCalendarEvent,
  AcademicCalendarEventKind,
  AcademicCalendarScope,
} from "@mms/shared";
import { academicCalendarEvents, sessionClassSections } from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { emitOutboxEvent } from "../../services/outboxEventService.js";

const TABLE_NAME = "academic_calendar_events";

export interface AcademicCalendarSaveInput {
  id: string;
  title: string;
  kind: AcademicCalendarEventKind;
  startOn: string;
  endOn: string;
  scope: AcademicCalendarScope;
  sessionId: string | null;
  classId: string | null;
  sectionId: string | null;
  notes: string | null;
  actorUserId: string;
}

export interface AcademicCalendarRange {
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

const t = academicCalendarEvents;
const columns = {
  id: t.id,
  title: t.title,
  kind: t.kind,
  startOn: t.startOn,
  endOn: t.endOn,
  scope: t.scope,
  sessionId: t.sessionId,
  classId: t.classId,
  sectionId: t.sectionId,
  notes: t.notes,
  deletedAt: t.deletedAt,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
};
type EventSelection = {
  id: string;
  title: string;
  kind: string;
  startOn: string;
  endOn: string;
  scope: string;
  sessionId: string | null;
  classId: string | null;
  sectionId: string | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toEvent(row: EventSelection): AcademicCalendarEvent {
  return {
    ...row,
    kind: row.kind as AcademicCalendarEventKind,
    scope: row.scope as AcademicCalendarScope,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Active events overlapping an inclusive date range (used by the instructional-day guard and metrics). */
export async function listCalendarEventsTx(
  tx: TenantTransaction,
  subdomain: string,
  range: AcademicCalendarRange,
): Promise<AcademicCalendarEvent[]> {
  const filters = [eq(t.workspaceSubdomain, subdomain)];
  if (!range.includeDeleted) filters.push(isNull(t.deletedAt));
  if (range.to) filters.push(lte(t.startOn, range.to));
  if (range.from) filters.push(gte(t.endOn, range.from));
  const rows = await tx
    .select(columns)
    .from(t)
    .where(and(...filters))
    .orderBy(asc(t.startOn), asc(t.title))
    .limit(2000);
  return rows.map(toEvent);
}

export async function listAcademicCalendarEvents(
  tenant: string,
  range: AcademicCalendarRange,
): Promise<AcademicCalendarEvent[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    if (range.includeDeleted) await enableIncludeDeleted(tx);
    return listCalendarEventsTx(tx, subdomain, range);
  });
}

async function selectById(
  tx: TenantTransaction,
  subdomain: string,
  id: string,
): Promise<AcademicCalendarEvent | null> {
  const [row] = await tx
    .select(columns)
    .from(t)
    .where(and(eq(t.workspaceSubdomain, subdomain), eq(t.id, id)))
    .limit(1);
  return row ? toEvent(row) : null;
}

async function assertSectionBelongsToClass(
  tx: TenantTransaction,
  subdomain: string,
  input: AcademicCalendarSaveInput,
): Promise<void> {
  if (input.scope !== "section" || !input.sectionId) return;
  const [section] = await tx
    .select({ id: sessionClassSections.id })
    .from(sessionClassSections)
    .where(
      and(
        eq(sessionClassSections.workspaceSubdomain, subdomain),
        eq(sessionClassSections.id, input.sectionId),
        eq(sessionClassSections.classId, input.classId ?? ""),
      ),
    )
    .limit(1);
  if (!section) throw new ValidationError("The section does not belong to the selected class");
}

/** Drops references that do not apply to the chosen scope (the DB check rejects mixed shapes). */
function scopedRefs(input: AcademicCalendarSaveInput) {
  return {
    sessionId: input.scope === "workspace" ? null : input.sessionId,
    classId: input.scope === "class" || input.scope === "section" ? input.classId : null,
    sectionId: input.scope === "section" ? input.sectionId : null,
  };
}

export async function saveAcademicCalendarEvent(
  tenant: string,
  input: AcademicCalendarSaveInput,
): Promise<AcademicCalendarEvent> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await assertSectionBelongsToClass(tx, subdomain, input);
    const fields = {
      title: input.title,
      kind: input.kind,
      startOn: input.startOn,
      endOn: input.endOn,
      scope: input.scope,
      ...scopedRefs(input),
      notes: input.notes,
    };
    await tx
      .insert(t)
      .values({
        id: input.id,
        workspaceSubdomain: subdomain,
        ...fields,
        createdBy: input.actorUserId,
      })
      .onConflictDoUpdate({
        target: [t.workspaceSubdomain, t.id],
        set: { ...fields, updatedAt: new Date() },
        setWhere: isNull(t.deletedAt),
      });
    const saved = await selectById(tx, subdomain, input.id);
    if (!saved || saved.deletedAt) throw new ConflictError("Restore this event before editing it");
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: TABLE_NAME,
      recordId: input.id,
      actionType: "UPDATE",
      realUserId: input.actorUserId,
      newState: fields,
    });
    return saved;
  });
}

export async function softDeleteAcademicCalendarEvent(
  tenant: string,
  id: string,
  actorUserId: string,
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const deletedAt = new Date();
    const changed = await tx
      .update(t)
      .set({
        deletedAt,
        deletedBy: actorUserId,
        deletionReason: "User deleted",
        updatedAt: deletedAt,
      })
      .where(and(eq(t.workspaceSubdomain, subdomain), eq(t.id, id), isNull(t.deletedAt)))
      .returning({ id: t.id });
    if (!changed.length) return false;
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: TABLE_NAME,
      recordId: id,
      actionType: "DELETE",
      realUserId: actorUserId,
    });
    await emitOutboxEvent(tx, "entity.soft_deleted", {
      entityType: TABLE_NAME,
      entityId: id,
      tenantId: subdomain,
      deletedAt: deletedAt.toISOString(),
      deletedBy: actorUserId,
      deletionReason: "User deleted",
      version: deletedAt.getTime(),
    });
    return true;
  });
}

export async function restoreAcademicCalendarEvent(
  tenant: string,
  id: string,
  actorUserId: string,
): Promise<AcademicCalendarEvent | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await enableIncludeDeleted(tx);
    const now = new Date();
    const changed = await tx
      .update(t)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: now,
        restoredBy: actorUserId,
        updatedAt: now,
      })
      .where(and(eq(t.workspaceSubdomain, subdomain), eq(t.id, id), isNotNull(t.deletedAt)))
      .returning({ id: t.id });
    if (!changed.length) return null;
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: TABLE_NAME,
      recordId: id,
      actionType: "RESTORE",
      realUserId: actorUserId,
    });
    await emitOutboxEvent(tx, "entity.restored", {
      entityType: TABLE_NAME,
      entityId: id,
      tenantId: subdomain,
      restoredAt: now.toISOString(),
      restoredBy: actorUserId,
      version: now.getTime(),
    });
    return selectById(tx, subdomain, id);
  });
}
