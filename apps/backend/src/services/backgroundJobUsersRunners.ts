import type { UserTransferEntity } from "@mms/shared";
import { registerModuleCsvImportJobRunner } from "../lib/registerModuleCsvImportJobRunner.js";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";
import { usersUseCases } from "../users/use-cases/usersUseCases.js";
import { resolveCurrentTenantRole } from "../lib/currentTenantRole.js";

/**
 * `users:import` background runner — bulk-provisions workspace users in INVITED status.
 *
 * Rows carry only name/email/role/phone (the `usersTransferSchema` never exports a password,
 * session token, or MFA secret). `setupMethod: "invite"` creates an inactive account with a random
 * password and dispatches the welcome email; `createWorkspaceUser` re-applies the role-assignment
 * guard (`canAssignRole`) so a row cannot grant a role above the importer's own.
 */
export function registerUsersImportJobRunner(): void {
  registerModuleCsvImportJobRunner<UserTransferEntity>({
    moduleId: "users",
    entityNounPlural: "users",
    importBatch: async (rows, ctx) => {
      const actorRole = (await resolveCurrentTenantRole(ctx.tenant, ctx.userId)) ?? undefined;
      let imported = 0;
      const errors: Array<{ row: number; reason: string }> = [];

      for (let index = 0; index < rows.length; index += 1) {
        throwIfBackgroundJobAborted(ctx.signal);
        const row = rows[index];
        try {
          await usersUseCases.createWorkspaceUser(
            {
              // Contact-less provisioning: the helper derives name/email/phone from the row when
              // `contactId` is empty (the schema brands it required, but the helper treats "" as none).
              contactId: "",
              name: row.name,
              email: row.email,
              role: row.role,
              phone: row.phone,
              status: "inactive",
              setupMethod: "invite",
              twoFactorEnabled: row.twoFactorEnabled ?? false,
            },
            ctx.userId,
            actorRole,
          );
          imported += 1;
        } catch (error) {
          errors.push({
            row: index + 1,
            reason: error instanceof Error ? error.message.slice(0, 300) : "Invalid row",
          });
        }
        if ((index + 1) % 10 === 0 || index + 1 === rows.length) {
          await ctx.updateProgress(index + 1, rows.length);
        }
      }

      return { imported, failed: errors.length, total: rows.length, errors };
    },
  });
}
