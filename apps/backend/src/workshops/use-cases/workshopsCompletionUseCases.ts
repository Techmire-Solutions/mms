import {
  countWorkshopDays,
  WORKSHOPS_MODULE_MANIFEST,
  workshopCertificatesBodySchema,
  workshopPreferencesSchema,
  type WorkshopCertificatesBody,
  type WorkshopPreferences,
  type WorkshopReportRow,
} from "@mms/shared";
import type { WorkshopsRepository } from "../repository/workshopsRepository.js";
import { workshopsRepository } from "../repository/workshopsRepositoryAdapter.js";
import { requireTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { withTenant } from "../../db/tenant-context.js";
import { runAfterCommit } from "../../db/commitScope.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { NotFoundError } from "../../lib/httpErrors.js";
import {
  assertCertificatesIssuable,
  assertWorkshopActivityEditable,
} from "../domain/workshopWriteGuards.js";
import {
  lockWorkshopTx,
  markCertificatesIssuedTx,
  saveCompletionOutcomesTx,
  workshopToday,
} from "../repository/workshopLifecycleRepositoryAdapter.js";
import { buildCompletionRows } from "../domain/workshopCompletionRules.js";

const EVENTS = WORKSHOPS_MODULE_MANIFEST.collectionKey;

/**
 * Completion, certificates, Reports and Setup defaults for workshops. "Today" is the workspace's
 * calendar day, so a workshop day only counts once it has begun where the madrasa is.
 *
 * Evaluation and certificate issuance own their transaction: they lock the workshop, read the
 * roster/attendance/scores, apply the pure completion rule and persist — one snapshot, one commit.
 */
export function createWorkshopsCompletionUseCases(repo: WorkshopsRepository = workshopsRepository) {
  const today = async (tenant: string) => todayInTimeZone(await repo.findWorkspaceTimezone(tenant));
  const rows = async (tenant: string, workshopId: string) => {
    const day = await today(tenant);
    return buildCompletionRows(await repo.loadCompletionInputs(tenant, workshopId, day), day);
  };

  return {
    /** Current standing of every participant; nothing is written. */
    getCompletion: (workshopId: string) => rows(requireTenant(), workshopId),

    /**
     * Evaluates and stores each participant's status, then returns the stored standing.
     *
     * A participant who already holds a certificate is pinned to `completed` by the persistence
     * primitive, so a re-evaluation can never downgrade issued evidence.
     */
    evaluateCompletion: async (workshopId: string) => {
      const tenant = requireTenant();
      const subdomain = tenant.trim().toLowerCase();
      return withTenant(subdomain, async (tx) => {
        const workshop = await lockWorkshopTx(tx, subdomain, workshopId);
        if (!workshop) throw new NotFoundError("Workshop not found");
        assertWorkshopActivityEditable(workshop);
        const day = await workshopToday(subdomain);

        const evaluated = buildCompletionRows(
          await repo.loadCompletionInputs(tenant, workshopId, day),
          day,
        );
        await saveCompletionOutcomesTx(
          tx,
          subdomain,
          workshopId,
          evaluated.map((row) => ({ participantId: row.participantId, status: row.status })),
        );
        runAfterCommit(() => broadcastCollection(EVENTS));
        return buildCompletionRows(await repo.loadCompletionInputs(tenant, workshopId, day), day);
      });
    },

    /** Issues certificates to stored-completed participants (all of them when none are named). */
    issueCertificates: async (workshopId: string, input: WorkshopCertificatesBody) => {
      const tenant = requireTenant();
      const subdomain = tenant.trim().toLowerCase();
      const body = workshopCertificatesBodySchema.parse(input);
      return withTenant(subdomain, async (tx) => {
        const workshop = await lockWorkshopTx(tx, subdomain, workshopId);
        if (!workshop) throw new NotFoundError("Workshop not found");
        const day = await workshopToday(subdomain);
        // Evidence that the workshop happened cannot be created before it happened.
        assertCertificatesIssuable(workshop, { today: day });

        // Eligibility is authoritative at issuance: recompute the standings from the current
        // facts, persist them, and certify only those that are completed *now*. A stored
        // `completed` from an earlier evaluation can no longer mint a certificate after the
        // attendance/scores were corrected, and a participant who now qualifies is certified
        // without a separate Evaluate click.
        const evaluated = buildCompletionRows(
          await repo.loadCompletionInputs(tenant, workshopId, day),
          day,
        );
        await saveCompletionOutcomesTx(
          tx,
          subdomain,
          workshopId,
          evaluated.map((row) => ({ participantId: row.participantId, status: row.status })),
        );
        const eligible = evaluated
          .filter((row) => row.status === "completed" && !row.certificateIssuedAt)
          .map((row) => row.participantId);
        const requested =
          body.participantIds.length > 0
            ? eligible.filter((participantId) => body.participantIds.includes(participantId))
            : eligible;
        const issued =
          requested.length > 0
            ? await markCertificatesIssuedTx(tx, subdomain, workshopId, requested)
            : [];
        if (issued.length > 0) runAfterCommit(() => broadcastCollection(EVENTS));
        return {
          issued,
          rows: buildCompletionRows(await repo.loadCompletionInputs(tenant, workshopId, day), day),
        };
      });
    },

    getReport: async (): Promise<WorkshopReportRow[]> => {
      const tenant = requireTenant();
      const day = await today(tenant);
      return (await repo.loadReportFacts(tenant, day)).map(
        ({ workshop, presentMarks, completed, certificates }) => {
          const possible =
            workshop.participantCount *
            countWorkshopDays(workshop.startDate, workshop.endDate, day);
          const capacity = workshop.capacity;
          return {
            workshopId: workshop.id,
            title: workshop.title,
            startDate: workshop.startDate,
            endDate: workshop.endDate,
            participants: workshop.participantCount,
            attendancePct: possible > 0 ? Math.round((presentMarks / possible) * 1000) / 10 : null,
            seatUtilizationPct:
              capacity && capacity > 0
                ? Math.round((workshop.participantCount / capacity) * 1000) / 10
                : null,
            completionPct:
              workshop.participantCount > 0
                ? Math.round((completed / workshop.participantCount) * 1000) / 10
                : null,
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
