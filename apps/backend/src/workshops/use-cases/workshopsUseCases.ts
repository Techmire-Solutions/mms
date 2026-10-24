import {
  WORKSHOPS_MODULE_MANIFEST,
  workshopEventUpdateSchema,
  type BaseListQuery,
  type WorkshopAttendanceDayBody,
  type WorkshopEventCreate,
  type WorkshopEventUpdate,
  type WorkshopScoresBody,
} from "@mms/shared";
import type { WorkshopsRepository } from "../repository/workshopsRepository.js";
import { workshopsRepository } from "../repository/workshopsRepositoryAdapter.js";
import { requireTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";

const EVENTS = WORKSHOPS_MODULE_MANIFEST.collectionKey;

/**
 * Workshops use-cases — composition root binding a {@link WorkshopsRepository} to every
 * operation. Callers run inside `withTenant`, so the tenant comes from request context.
 */
export function createWorkshopsUseCases(repo: WorkshopsRepository = workshopsRepository) {
  const today = async (tenant: string) => todayInTimeZone(await repo.findWorkspaceTimezone(tenant));

  return {
    listWorkshops: (query: BaseListQuery) => repo.listWorkshopsPage(requireTenant(), query),

    getWorkshop: async (id: string) => {
      const detail = await repo.loadWorkshopDetail(requireTenant(), id);
      if (!detail) throw new NotFoundError("Workshop not found");
      return detail;
    },

    createWorkshop: async (input: WorkshopEventCreate) => {
      try {
        const workshop = await repo.insertWorkshop(
          requireTenant(),
          input.id ?? crypto.randomUUID(),
          input,
        );
        await broadcastCollection(EVENTS);
        return workshop;
      } catch (error) {
        if (isUniqueViolation(error))
          throw new ConflictError("A workshop with this id already exists");
        throw error;
      }
    },

    updateWorkshop: async (id: string, patch: WorkshopEventUpdate) => {
      const tenant = requireTenant();
      const current = await repo.findWorkshopById(tenant, id);
      if (!current || current.deletedAt) throw new NotFoundError("Workshop not found");
      // Re-check date order against the stored values the patch leaves untouched.
      const merged = workshopEventUpdateSchema.safeParse({
        startDate: patch.startDate === undefined ? current.startDate : patch.startDate,
        endDate: patch.endDate === undefined ? current.endDate : patch.endDate,
        registrationDeadline:
          patch.registrationDeadline === undefined
            ? current.registrationDeadline
            : patch.registrationDeadline,
      });
      if (!merged.success) {
        throw new ValidationError(merged.error.issues[0]?.message ?? "Invalid workshop dates");
      }
      const updated = await repo.updateWorkshop(tenant, id, patch);
      if (!updated) throw new NotFoundError("Workshop not found");
      await broadcastCollection(EVENTS);
      return updated;
    },

    deleteWorkshops: async (ids: string[], deletedBy: string | null, reason: string | null) => {
      const result = await repo.softDeleteWorkshops(requireTenant(), ids, deletedBy, reason);
      if (result.succeeded > 0) await broadcastCollection(EVENTS);
      return result;
    },

    restoreWorkshop: async (id: string, restoredBy: string | null) => {
      const restored = await repo.restoreWorkshop(requireTenant(), id, restoredBy);
      if (!restored) throw new NotFoundError("Workshop not found in trash");
      await broadcastCollection(EVENTS);
    },

    addParticipant: async (workshopId: string, contactId: string) => {
      const tenant = requireTenant();
      try {
        const participant = await repo.registerParticipant(tenant, {
          id: crypto.randomUUID(),
          workshopId,
          contactId,
          today: await today(tenant),
        });
        await broadcastCollection(EVENTS);
        return participant;
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError("This contact is already registered");
        throw error;
      }
    },

    removeParticipant: async (
      workshopId: string,
      participantId: string,
      deletedBy: string | null,
    ) => {
      const removed = await repo.withdrawParticipant(requireTenant(), {
        workshopId,
        participantId,
        deletedBy,
      });
      if (!removed) throw new NotFoundError("Participant not found");
      await broadcastCollection(EVENTS);
    },

    saveAttendanceDay: (
      workshopId: string,
      body: WorkshopAttendanceDayBody,
      markedBy: string | null,
    ) => repo.saveAttendanceDay(requireTenant(), workshopId, body, markedBy),

    saveScores: (workshopId: string, body: WorkshopScoresBody) =>
      repo.saveScores(requireTenant(), workshopId, body),

    loadMetrics: async () => {
      const tenant = requireTenant();
      return repo.aggregateWorkshopsMetrics(tenant, await today(tenant));
    },
  };
}

export const workshopsUseCases = createWorkshopsUseCases();
