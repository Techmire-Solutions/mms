import type { AttendanceRecord, User } from "@mms/shared";
import { withTenant } from "../../db/tenant-context.js";
import { assertAttendanceDayEditable } from "./attendancePolicyGuard.js";
import { auditAttendanceMutation } from "./attendanceAudit.js";
import { requireTenant, type AttendanceMutationDeps } from "./attendanceUseCaseSupport.js";

/**
 * Trash use-cases: archive and restore marks.
 *
 * These carry no incoming status, so they run the lighter day gate (submitted-day lock + cut-off)
 * instead of the full write policy — deleting a mark after the cut-off is the same evidence change
 * as editing it.
 */
export function createAttendanceTrashUseCases({ repo, crud, policyStore }: AttendanceMutationDeps) {
  const canEdit = (tenant: string, actor: User, records: readonly AttendanceRecord[]) =>
    assertAttendanceDayEditable({ tenant, actor, records, store: policyStore });

  return {
    deleteAttendanceRecordById: async (
      id: string,
      actor: User,
      deletionReason?: string,
    ): Promise<boolean> => {
      const tenant = requireTenant();
      return withTenant(
        tenant,
        async (tx) => {
          const existing = await repo.findAttendanceRecordById(tenant, id);
          if (!existing || existing.deletedAt) return false;
          await canEdit(tenant, actor, [existing]);

          const deleted = await crud.deleteById(id, String(actor.id), deletionReason);
          if (!deleted) return false;
          await auditAttendanceMutation(tx, {
            tenant,
            actor,
            action: "DELETE",
            record: existing,
            reason: deletionReason,
          });
          return true;
        },
        { readOnly: false },
      );
    },

    restoreAttendanceRecordById: async (id: string, actor: User): Promise<boolean> => {
      const tenant = requireTenant();
      return withTenant(
        tenant,
        async (tx) => {
          const existing = await repo.findAttendanceRecordById(tenant, id);
          if (!existing) return false;
          await canEdit(tenant, actor, [existing]);

          const restored = await crud.restoreById(id, String(actor.id));
          if (!restored) return false;
          const after = await repo.findAttendanceRecordById(tenant, id);
          if (after) {
            await auditAttendanceMutation(tx, {
              tenant,
              actor,
              action: "RESTORE",
              record: after,
              before: existing,
            });
          }
          return true;
        },
        { readOnly: false },
      );
    },

    bulkSoftDeleteAttendance: async (
      ids: string[],
      actor: User,
      deletionReason?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = requireTenant();
      return withTenant(
        tenant,
        async (tx) => {
          const before = await repo.findAttendanceRecordsByIds(tenant, ids);
          const live = before.filter((record) => !record.deletedAt);
          await canEdit(tenant, actor, live);

          const result = await crud.bulkDeleteByIds(ids, String(actor.id), deletionReason);
          for (const record of live) {
            await auditAttendanceMutation(tx, {
              tenant,
              actor,
              action: "DELETE",
              record,
              reason: deletionReason,
            });
          }
          return result;
        },
        { readOnly: false },
      );
    },

    bulkRestoreAttendance: async (
      ids: string[],
      actor: User,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = requireTenant();
      return withTenant(
        tenant,
        async (tx) => {
          const before = await repo.findAttendanceRecordsByIds(tenant, ids);
          await canEdit(tenant, actor, before);

          const result = await crud.bulkRestoreByIds(ids, String(actor.id));
          for (const record of before) {
            const after = await repo.findAttendanceRecordById(tenant, record.id);
            if (!after) continue;
            await auditAttendanceMutation(tx, {
              tenant,
              actor,
              action: "RESTORE",
              record: after,
              before: record,
            });
          }
          return result;
        },
        { readOnly: false },
      );
    },
  };
}
