import type {
  BaseListQuery,
  WorkshopAttendanceDayBody,
  WorkshopAttendanceMark,
  WorkshopDetail,
  WorkshopEvent,
  WorkshopEventCreate,
  WorkshopEventUpdate,
  WorkshopParticipant,
  WorkshopScore,
  WorkshopScoresBody,
  WorkshopsCommandMetricsSnapshot,
} from "@mms/shared";
import type { WorkshopsPage } from "../../db/repositories/workshopEventsRepository.js";

/**
 * Sole storage gateway for the workshops module (events, participants, per-day check-in,
 * scores). Use-cases depend on this port; the Drizzle adapter is the only implementation, and
 * tests can inject a fake at the seam.
 */
export interface WorkshopsRepository {
  listWorkshopsPage(tenant: string, query: BaseListQuery): Promise<WorkshopsPage>;
  findWorkshopById(tenant: string, id: string): Promise<WorkshopEvent | null>;
  loadWorkshopDetail(tenant: string, id: string): Promise<WorkshopDetail | null>;
  insertWorkshop(tenant: string, id: string, input: WorkshopEventCreate): Promise<WorkshopEvent>;
  updateWorkshop(
    tenant: string,
    id: string,
    patch: WorkshopEventUpdate,
  ): Promise<WorkshopEvent | null>;
  softDeleteWorkshops(
    tenant: string,
    ids: string[],
    deletedBy: string | null,
    deletionReason: string | null,
  ): Promise<{ succeeded: number; failed: number }>;
  restoreWorkshop(tenant: string, id: string, restoredBy: string | null): Promise<boolean>;
  registerParticipant(
    tenant: string,
    input: { id: string; workshopId: string; contactId: string; today: string },
  ): Promise<WorkshopParticipant>;
  withdrawParticipant(
    tenant: string,
    input: { workshopId: string; participantId: string; deletedBy: string | null },
  ): Promise<boolean>;
  saveAttendanceDay(
    tenant: string,
    workshopId: string,
    body: WorkshopAttendanceDayBody,
    markedBy: string | null,
  ): Promise<WorkshopAttendanceMark[]>;
  saveScores(
    tenant: string,
    workshopId: string,
    body: WorkshopScoresBody,
  ): Promise<WorkshopScore[]>;
  aggregateWorkshopsMetrics(
    tenant: string,
    today: string,
  ): Promise<WorkshopsCommandMetricsSnapshot>;
  findWorkspaceTimezone(tenant: string): Promise<string | null>;
}
