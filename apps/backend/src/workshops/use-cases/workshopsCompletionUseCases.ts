import {
  evaluateWorkshopCompletion,
  listWorkshopDays,
  WORKSHOPS_MODULE_MANIFEST,
  workshopCertificatesBodySchema,
  workshopPreferencesSchema,
  type WorkshopCertificatesBody,
  type WorkshopCompletionRow,
  type WorkshopEvent,
  type WorkshopPreferences,
  type WorkshopReportRow,
} from "@mms/shared";
import type {
  WorkshopCompletionInputs,
  WorkshopsRepository,
} from "../repository/workshopsRepository.js";
import { workshopsRepository } from "../repository/workshopsRepositoryAdapter.js";
import { requireTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { broadcastCollection } from "../../lib/livePush.js";

const EVENTS = WORKSHOPS_MODULE_MANIFEST.collectionKey;

/** Workshop days that have already happened (inclusive of today). */
function countableDays(workshop: WorkshopEvent, today: string): number {
  return listWorkshopDays(workshop.startDate, workshop.endDate).filter((day) => day <= today)
    .length;
}

function toRows(inputs: WorkshopCompletionInputs, today: string): WorkshopCompletionRow[] {
  const days = countableDays(inputs.workshop, today);
  const criteria = {
    minAttendancePct: inputs.workshop.minAttendancePct,
    minScorePct: inputs.workshop.minScorePct,
  };
  return inputs.participants.map((participant) => {
    const score = inputs.scores.get(participant.id) ?? { total: 0, max: 0 };
    const result = evaluateWorkshopCompletion(
      {
        countableDays: days,
        presentDays: inputs.presentDays.get(participant.id) ?? 0,
        scoreTotal: score.total,
        scoreMax: score.max,
      },
      criteria,
    );
    return {
      participantId: participant.id,
      contactName: participant.contactName,
      attendancePct: result.attendancePct,
      scorePct: result.scorePct,
      status: result.status,
      shortfalls: result.shortfalls,
      completedAt: participant.completedAt,
      certificateIssuedAt: participant.certificateIssuedAt,
    };
  });
}

/**
 * Completion, certificates, Reports and Setup defaults for workshops. "Today" is the workspace's
 * calendar day, so a workshop day only counts once it has begun where the madrasa is.
 */
export function createWorkshopsCompletionUseCases(repo: WorkshopsRepository = workshopsRepository) {
  const today = async (tenant: string) => todayInTimeZone(await repo.findWorkspaceTimezone(tenant));
  const rows = async (tenant: string, workshopId: string) => {
    const day = await today(tenant);
    return toRows(await repo.loadCompletionInputs(tenant, workshopId, day), day);
  };

  return {
    /** Current standing of every participant; nothing is written. */
    getCompletion: (workshopId: string) => rows(requireTenant(), workshopId),

    /** Evaluates and stores each participant's status, then returns the stored standing. */
    evaluateCompletion: async (workshopId: string) => {
      const tenant = requireTenant();
      const evaluated = await rows(tenant, workshopId);
      await repo.saveCompletionOutcomes(
        tenant,
        workshopId,
        evaluated.map((row) => ({ participantId: row.participantId, status: row.status })),
      );
      await broadcastCollection(EVENTS);
      return rows(tenant, workshopId);
    },

    /** Issues certificates to stored-completed participants (all of them when none are named). */
    issueCertificates: async (workshopId: string, input: WorkshopCertificatesBody) => {
      const tenant = requireTenant();
      const body = workshopCertificatesBodySchema.parse(input);
      const issued = await repo.markCertificatesIssued(tenant, workshopId, body.participantIds);
      if (issued.length > 0) await broadcastCollection(EVENTS);
      return { issued, rows: await rows(tenant, workshopId) };
    },

    getReport: async (): Promise<WorkshopReportRow[]> => {
      const tenant = requireTenant();
      const day = await today(tenant);
      return (await repo.loadReportFacts(tenant, day)).map(
        ({ workshop, presentMarks, completed, certificates }) => {
          const possible = workshop.participantCount * countableDays(workshop, day);
          return {
            workshopId: workshop.id,
            title: workshop.title,
            startDate: workshop.startDate,
            endDate: workshop.endDate,
            participants: workshop.participantCount,
            attendancePct: possible > 0 ? Math.round((presentMarks / possible) * 1000) / 10 : null,
            completed,
            certificates,
          };
        },
      );
    },

    getPreferences: () => repo.loadWorkshopPreferences(requireTenant()),

    savePreferences: (input: WorkshopPreferences) =>
      repo.saveWorkshopPreferences(requireTenant(), workshopPreferencesSchema.parse(input)),
  };
}

export const workshopsCompletionUseCases = createWorkshopsCompletionUseCases();
