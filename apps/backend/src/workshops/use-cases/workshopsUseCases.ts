import {
  WORKSHOPS_MODULE_MANIFEST,
  type BaseListQuery,
  type WorkshopAttendanceDayBody,
  type WorkshopEventCreate,
  type WorkshopEventUpdate,
  type WorkshopScoresBody,
  type WorkshopTransitionBody,
} from "@mms/shared";
import type { WorkshopsRepository } from "../repository/workshopsRepository.js";
import { workshopsRepository } from "../repository/workshopsRepositoryAdapter.js";
import { requireTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import { transitionWorkshop as transition } from "./workshopLifecycleUseCases.js";

const EVENTS = WORKSHOPS_MODULE_MANIFEST.collectionKey;

/**
 * Workshops use-cases — composition root binding a {@link WorkshopsRepository} to every
 * operation. Callers run inside `withTenant`, so the tenant comes from request context.
 */
export function createWorkshopsUseCases(repo: WorkshopsRepository = workshopsRepository) {
  const today = async (tenant: string) => todayInTimeZone(await repo.findWorkspaceTimezone(tenant));

  return {
    listWorkshops: (query: BaseListQuery) => repo.listWorkshopsPage(requireTenant(), query),

    getWorkshop: async (id: string, options: { includeContactDetails?: boolean } = {}) => {
      const detail = await repo.loadWorkshopDetail(requireTenant(), id);
      if (!detail) throw new NotFoundError("Workshop not found");
      if (options.includeContactDetails === false) {
        const mask = <T extends { contactPhone: string }>(row: T): T => ({
          ...row,
          contactPhone: "",
        });
        detail.participants = detail.participants.map(mask);
        detail.waitlisted = detail.waitlisted.map(mask);
      }
      return detail;
    },

    /** Light existence check for enqueue paths (no roster/attendance hydration). */
    ensureWorkshop: async (id: string) => {
      const workshop = await repo.findWorkshopById(requireTenant(), id);
      if (!workshop) throw new NotFoundError("Workshop not found");
      return workshop;
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
        if (isUniqueViolation(error)) {
          throw new ConflictError("A workshop with this id already exists", "workshop_exists");
        }
        throw error;
      }
    },

    updateWorkshop: async (id: string, patch: WorkshopEventUpdate) => {
      // The adapter locks the row and re-validates the merged dates/state under that lock; the
      // use case no longer pre-reads into a separate transaction (the old TOCTOU hole).
      const updated = await repo.updateWorkshop(requireTenant(), id, patch);
      if (!updated) throw new NotFoundError("Workshop not found");
      await broadcastCollection(EVENTS);
      return updated;
    },

    /** Lifecycle actions (publish/unpublish/complete/cancel) — the only status write path. */
    transitionWorkshop: async (
      id: string,
      body: WorkshopTransitionBody,
      actor: { id?: string | null; label?: string | null },
      expectedUpdatedAt: string | null | undefined,
    ) => {
      const workshop = await transition(requireTenant(), id, body, actor, expectedUpdatedAt);
      return workshop;
    },

    /** Single-record archive; the bulk route keeps the counts-returning `deleteWorkshops`. */
    deleteWorkshop: async (id: string, deletedBy: string | null, reason: string | null) => {
      const result = await repo.softDeleteWorkshops(requireTenant(), [id], deletedBy, reason);
      if (result.succeeded === 0) throw new NotFoundError("Workshop not found");
      await broadcastCollection(EVENTS);
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
        });
        await broadcastCollection(EVENTS);
        return participant;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictError("This contact is already registered", "already_registered");
        }
        throw error;
      }
    },

    /** Registers several contacts atomically; overflow is queued when the waitlist is enabled. */
    addParticipants: async (workshopId: string, contactIds: string[]) => {
      try {
        const result = await repo.registerParticipants(requireTenant(), { workshopId, contactIds });
        if (result.added.length + result.waitlisted.length > 0) await broadcastCollection(EVENTS);
        return result;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictError("This contact is already registered", "already_registered");
        }
        throw error;
      }
    },

    /**
     * Withdraws a registration. Returns the queued participant promoted into the freed seat, when
     * one existed, so the caller can announce it.
     */
    removeParticipant: async (
      workshopId: string,
      participantId: string,
      deletedBy: string | null,
    ) => {
      const result = await repo.withdrawParticipant(requireTenant(), {
        workshopId,
        participantId,
        deletedBy,
      });
      if (!result.removed) throw new NotFoundError("Participant not found");
      await broadcastCollection(EVENTS);
      return result.promoted;
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
