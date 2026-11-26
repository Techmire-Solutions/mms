import { DEFAULT_WORKSPACE_ROLES, type WorkspaceRole } from "@mms/contracts";
import type { IamTenantContext } from "../../shared/types.js";
import type { TenantIamPort } from "../ports.js";
import { usersUseCases } from "./use-cases/usersUseCases.js";
import { getTenantUsersSettings } from "./services/usersSettingsService.js";

/** In-module tenant IAM port backed by the moved users use-cases. */
export function createTenantIamPort(): TenantIamPort {
  return {
    listMembers: async (_ctx: IamTenantContext, query) =>
      usersUseCases.loadUsersPage(query as Parameters<typeof usersUseCases.loadUsersPage>[0]),
    inviteMember: (_ctx, input) =>
      usersUseCases.inviteWorkspaceUser(
        input,
        String(_ctx.actor.id),
        _ctx.actor.role,
        _ctx.ip,
        _ctx.origin,
      ),
    createMember: (_ctx, input) =>
      usersUseCases.createWorkspaceUser(
        input,
        String(_ctx.actor.id),
        _ctx.actor.role,
        _ctx.ip,
        _ctx.origin,
      ),
    updateMember: (_ctx, id, input) =>
      usersUseCases.updateWorkspaceUser(id, input, String(_ctx.actor.id), _ctx.actor.role, _ctx.ip),
    removeMember: (_ctx, id) =>
      usersUseCases.deleteUserById(id, String(_ctx.actor.id), _ctx.actor.role, _ctx.ip),
    restoreMember: (_ctx, id) =>
      usersUseCases.restoreUserById(id, _ctx.actor.role, String(_ctx.actor.id), _ctx.ip),
    resetMemberPassword: (_ctx, id, temporaryPassword) =>
      usersUseCases.resetUserPasswordById(
        id,
        temporaryPassword,
        _ctx.actor.role,
        String(_ctx.actor.id),
        _ctx.ip,
      ),
    loadMembers: async () => {
      const users = await usersUseCases.loadWorkspaceUsers();
      return users.map((user) => ({
        id: String(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status ?? "active",
        contactId: user.contactId,
        deletedAt: user.deletedAt ?? null,
      }));
    },
    listRoles: async (): Promise<WorkspaceRole[]> => {
      const settings = await getTenantUsersSettings();
      return settings.workspaceRoles ?? [...DEFAULT_WORKSPACE_ROLES];
    },
  };
}
