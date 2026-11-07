import { createHash } from "node:crypto";
import {
  buildRolloverSession,
  isoDayOffset,
  type RolloverIdMaps,
  type Session,
  type SessionRolloverBody,
} from "@mms/shared";
import { sessionsRepository } from "../repository/sessionsRepositoryAdapter.js";
import { sessionRolloverRepository as runs } from "../repository/sessionRolloverRepositoryAdapter.js";
import { sessionsAcademicRepository as academic } from "../repository/sessionsAcademicRepositoryAdapter.js";
import { copySessionCalendarEvents } from "../../attendance/use-cases/academicCalendarCopyUseCases.js";
import { withTenant } from "../../db/tenant-context.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";
import type { SessionRolloverJobPayload } from "./sessionRolloverUseCases.js";

export interface RolloverWarning {
  kind: "staff_skipped" | "calendar_skipped" | "carry_skipped" | "source_not_finalised" | string;
  detail: string;
}

/** Records a copy the run could not make; it must never be swallowed silently. */
export type RolloverWarn = (warning: RolloverWarning) => Promise<void>;

const ID_PREFIX: Record<string, string> = {
  session: "ses",
  class: "cls",
  section: "sec",
  fee: "fee",
  discount: "dsc",
  scholarship: "sch",
  eligibility: "elg",
  schedule: "scl",
  event: "evt",
  enrollment: "enr",
};

/**
 * Stable id for a rollover artefact. A retried run mints the same ids, so `saveSession` /
 * `bulkSaveEnrollments` upsert instead of creating orphan/duplicate rows (review finding R1/R2).
 */
export function deterministicRolloverId(runId: string, kind: string, sourceId: string): string {
  const hash = createHash("sha256").update(`${runId}:${kind}:${sourceId}`).digest("hex");
  return `${ID_PREFIX[kind] ?? kind}-${hash.slice(0, 26)}`;
}

/** Pairs rows by name in occurrence order (classes/sections may share a name across classes). */
function pairByName<T extends { id: string; name: string }>(
  sourceRows: readonly T[],
  targetRows: readonly T[],
): Map<string, string> {
  const byName = new Map<string, T[]>();
  for (const row of targetRows) {
    const key = row.name.trim().toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), row]);
  }
  const used = new Map<string, number>();
  const pairs = new Map<string, string>();
  for (const row of sourceRows) {
    const key = row.name.trim().toLowerCase();
    const index = used.get(key) ?? 0;
    const match = byName.get(key)?.[index];
    if (!match) continue;
    used.set(key, index + 1);
    pairs.set(row.id, match.id);
  }
  return pairs;
}

/** Id maps of an earlier attempt's target, matched by class and section name. */
function mapsByName(source: Session, target: Session): RolloverIdMaps {
  const ids: RolloverIdMaps = { classIds: new Map(), sectionIds: new Map() };
  const classPairs = pairByName(source.classes, target.classes);
  for (const cls of source.classes) {
    const copyId = classPairs.get(cls.id);
    if (!copyId) continue;
    const copy = target.classes.find((candidate) => candidate.id === copyId);
    if (!copy) continue;
    ids.classIds.set(cls.id, copyId);
    const sectionPairs = pairByName(cls.sections ?? [], copy.sections ?? []);
    for (const [sourceId, targetId] of sectionPairs) ids.sectionIds.set(sourceId, targetId);
  }
  return ids;
}

async function copySectionStaff(
  tenant: string,
  sectionIds: ReadonlyMap<string, string>,
  startOn: string,
  actorUserId: string,
  warn: RolloverWarn,
): Promise<void> {
  for (const [sourceSectionId, targetSectionId] of sectionIds) {
    const current = (await academic.listSectionStaff(tenant, sourceSectionId)).filter(
      (row) => row.endOn === null,
    );
    for (const row of current) {
      try {
        await academic.assignSectionStaff(
          tenant,
          targetSectionId,
          {
            facultyId: row.facultyId,
            role: row.role,
            subjectId: row.subjectId,
            startOn,
            reason: "Copied in a session rollover",
          },
          actorUserId,
        );
      } catch (error) {
        if (error instanceof ValidationError || error instanceof ConflictError) {
          await warn({
            kind: "staff_skipped",
            detail: `${row.facultyId} on section ${targetSectionId}: ${error.message}`,
          });
          continue;
        }
        throw error;
      }
    }
  }
}

/**
 * Creates (or, on a retry, resumes) the draft target session and its copy phases. Each phase is
 * stamped on the run after it succeeds, so a failed attempt resumes instead of duplicating staff,
 * calendar events or structure (review finding R1).
 */
export async function ensureTarget(
  tenant: string,
  runId: string,
  source: Session,
  payload: SessionRolloverJobPayload,
  actorUserId: string,
  warn: RolloverWarn,
): Promise<{ target: Session; ids: RolloverIdMaps }> {
  const phases = await runs.findPromotionRunForUpdate(tenant, runId);
  const existing = phases?.targetSessionId
    ? await sessionsRepository.findSessionByIdPrimary(tenant, phases.targetSessionId)
    : null;

  let target: Session;
  let ids: RolloverIdMaps;
  if (existing) {
    target = existing;
    ids = mapsByName(source, existing);
  } else {
    const built = buildRolloverSession(
      source,
      payload.body as Pick<SessionRolloverBody, "target" | "copy">,
      () => deterministicRolloverId(runId, "misc", Math.random().toString(36)),
      (kind, sourceId) => deterministicRolloverId(runId, kind, sourceId),
    );
    // A `duplicate` run copies the structure for the *same* period on purpose (parallel cohort).
    if (payload.body.mode === "duplicate") built.session.overlapExempt = true;
    await withTenant(tenant, async () => {
      await sessionsRepository.saveSession(tenant, built.session);
      await runs.updatePromotionRun(tenant, runId, {
        targetSessionId: built.session.id,
        structureCopiedAt: new Date(),
      });
    });
    target = built.session;
    ids = built.ids;
  }

  if (!phases?.structureCopiedAt) {
    await runs.updatePromotionRun(tenant, runId, { structureCopiedAt: new Date() });
  }
  if (payload.body.copy.staff && !phases?.staffCopiedAt) {
    await copySectionStaff(
      tenant,
      ids.sectionIds,
      payload.body.target.startDate,
      actorUserId,
      warn,
    );
    await runs.updatePromotionRun(tenant, runId, { staffCopiedAt: new Date() });
  }
  if (payload.body.copy.calendar && source.startDate && !phases?.calendarCopiedAt) {
    await copySessionCalendarEvents(
      tenant,
      {
        sourceSessionId: source.id,
        targetSessionId: target.id,
        range: { from: source.startDate, to: source.endDate || payload.body.target.endDate },
        offsetDays: isoDayOffset(source.startDate, payload.body.target.startDate),
        classIds: ids.classIds,
        sectionIds: ids.sectionIds,
        actorUserId,
      },
      {
        idFor: (sourceEventId) => deterministicRolloverId(runId, "event", sourceEventId),
        onSkip: (info) => warn({ kind: "calendar_skipped", detail: info.reason }),
      },
    );
    await runs.updatePromotionRun(tenant, runId, { calendarCopiedAt: new Date() });
  }
  return { target, ids };
}
