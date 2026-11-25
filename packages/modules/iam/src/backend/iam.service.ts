import { bypassTenantScope } from "@mms/db";
import { IamError } from "../shared/errors.js";
import {
  assertCanManageMember,
  assertPlatformActionReason,
  assertLastAdminRetained,
  assertPlatformIamAccess,
  canSuspendTenantUser,
  isActiveAdmin,
} from "../shared/policy.js";
import type {
  CreateWorkspaceUserInput,
  EditWorkspaceUserInput,
  InviteWorkspaceUserInput,
  PlatformUserProfile,
  WorkspaceRole,
  WorkspaceUser,
} from "@mms/contracts";
import type { IamMemberSummary, IamPlatformActor, IamTenantContext } from "../shared/types.js";
import { searchPlatformOrganizations, searchPlatformUsers } from "./iamPlatformSearch.js";
import type { IamPorts, TenantMemberPage } from "./ports.js";

function assertActor(actor: { id?: string | number } | undefined): string {
  const id = actor?.id == null ? "" : String(actor.id);
  if (!id.trim())
    throw new IamError("unauthorized", "IAM operation requires an authenticated actor");
  return id;
}

export function createIamService(ports: IamPorts) {
  return {
    async listMembers(
      ctx: IamTenantContext,
      query: Record<string, unknown>,
    ): Promise<TenantMemberPage> {
      assertActor(ctx.actor);
      return ports.tenant.listMembers(ctx, query);
    },

    async inviteMember(ctx: IamTenantContext, input: InviteWorkspaceUserInput) {
      assertActor(ctx.actor);
      assertCanManageMember(ctx.actor.role, input.role);
      return ports.tenant.inviteMember(ctx, input);
    },

    async createMember(ctx: IamTenantContext, input: CreateWorkspaceUserInput) {
      assertActor(ctx.actor);
      assertCanManageMember(ctx.actor.role, input.role);
      return ports.tenant.createMember(ctx, input);
    },

    async updateMember(
      ctx: IamTenantContext,
      id: string,
      input: Partial<EditWorkspaceUserInput>,
    ): Promise<WorkspaceUser> {
      assertActor(ctx.actor);
      const members = await ports.tenant.loadMembers(ctx);
      const target = members.find((member) => member.id === id);
      if (!target) throw new IamError("not_found", "Member not found");
      assertCanManageMember(ctx.actor.role, target.role);
      if (input.role) assertCanManageMember(ctx.actor.role, input.role);
      // A role change can demote an admin just as surely as a status change:
      // gate on the *resulting* role+status so the workspace keeps an active admin.
      const nextMember = {
        ...target,
        role: input.role ?? target.role,
        status: input.status ?? target.status,
      };
      if (isActiveAdmin(target) && !isActiveAdmin(nextMember)) {
        assertLastAdminRetained(members, id, "suspended");
      }
      return ports.tenant.updateMember(ctx, id, input);
    },

    async removeMember(ctx: IamTenantContext, id: string): Promise<boolean> {
      assertActor(ctx.actor);
      const members = await ports.tenant.loadMembers(ctx);
      const target = members.find((member) => member.id === id);
      if (!target) return false;
      assertCanManageMember(ctx.actor.role, target.role);
      assertLastAdminRetained(members, id, "suspended");
      return ports.tenant.removeMember(ctx, id);
    },

    async restoreMember(ctx: IamTenantContext, id: string): Promise<boolean> {
      assertActor(ctx.actor);
      return ports.tenant.restoreMember(ctx, id);
    },

    async resetMemberPassword(
      ctx: IamTenantContext,
      id: string,
      temporaryPassword: string,
    ): Promise<boolean> {
      assertActor(ctx.actor);
      // Self-reset must go through the current-password flow, never the admin endpoint.
      if (String(ctx.actor.id) === id) {
        throw new IamError(
          "forbidden",
          "Cannot reset your own password through the admin endpoint",
        );
      }
      const members = await ports.tenant.loadMembers(ctx);
      const target = members.find((member) => member.id === id);
      if (!target) return false;
      assertCanManageMember(ctx.actor.role, target.role);
      return ports.tenant.resetMemberPassword(ctx, id, temporaryPassword);
    },

    async listRoles(ctx: IamTenantContext): Promise<WorkspaceRole[]> {
      assertActor(ctx.actor);
      return ports.tenant.listRoles(ctx);
    },

    async listPlatformAdmins(actor: IamPlatformActor): Promise<PlatformUserProfile[]> {
      assertPlatformIamAccess(actor);
      return ports.platform.listAdmins();
    },

    async searchUsers(actor: IamPlatformActor, query: string, page = 1, limit = 25) {
      return searchPlatformUsers(ports, actor, query, page, limit);
    },

    async searchOrganizations(actor: IamPlatformActor, query: string, page = 1, limit = 25) {
      return searchPlatformOrganizations(ports, actor, query, page, limit);
    },

    async setTenantUserStatus(
      actor: IamPlatformActor,
      input: {
        tenant: string;
        userId: string;
        status: "active" | "suspended";
        reason: string;
        currentPassword: string;
        ip?: string;
      },
    ): Promise<{ tenant: string; user: IamMemberSummary }> {
      assertPlatformIamAccess(actor, { requireSuperUser: true });
      if (!(await ports.platform.verifyActorPassword(actor.id, input.currentPassword))) {
        throw new IamError("bad_request", "Current password is incorrect");
      }
      const reason = assertPlatformActionReason(input.reason);
      const target = await bypassTenantScope(
        {
          reason: "platform IAM tenant user suspension",
          actorId: actor.id,
          auditMeta: { tenant: input.tenant, userId: input.userId, status: input.status },
        },
        () => ports.platform.findTenantUser(input.tenant, input.userId),
      );
      if (!target) throw new IamError("not_found", "Tenant user not found");
      if (!canSuspendTenantUser({ id: actor.id, role: actor.role }, target)) {
        throw new IamError("forbidden", "Cannot suspend this tenant user");
      }
      const updated = await bypassTenantScope(
        {
          reason: "platform IAM tenant user suspension",
          actorId: actor.id,
          auditMeta: { tenant: input.tenant, userId: input.userId, status: input.status, reason },
        },
        async () => {
          const result = await ports.platform.setTenantUserStatus(
            input.tenant,
            input.userId,
            input.status,
            reason,
          );
          await ports.platform.revokeTenantUserSessions(input.tenant, input.userId);
          return result;
        },
      );
      const auditId = await ports.platform.insertPlatformActivity({
        actor,
        action: input.status === "suspended" ? "suspend_tenant_user" : "reactivate_tenant_user",
        targetResource: "tenant_user",
        targetId: `${input.tenant}:${input.userId}`,
        metadataMessage: reason,
        ip: input.ip,
      });
      await ports.audit.recordTenantAudit({
        tenant: input.tenant,
        actorId: actor.id,
        action:
          input.status === "suspended" ? "platform.user.suspended" : "platform.user.reactivated",
        targetId: input.userId,
        metadata: { reason, auditId },
      });
      return { tenant: input.tenant, user: updated };
    },

    async beginImpersonation(
      actor: IamPlatformActor,
      input: { tenant: string; userId: string; reason: string; currentPassword: string },
    ): Promise<{ handoffUrl: string; expiresAt: string; auditId: string }> {
      assertPlatformIamAccess(actor, { requireSuperUser: true });
      if (input.tenant === "") throw new IamError("bad_request", "Tenant is required");
      if (!(await ports.platform.verifyActorPassword(actor.id, input.currentPassword))) {
        throw new IamError("bad_request", "Current password is incorrect");
      }
      const reason = assertPlatformActionReason(input.reason);
      const target = await bypassTenantScope(
        {
          reason: "platform IAM impersonation",
          actorId: actor.id,
          auditMeta: { tenant: input.tenant, userId: input.userId },
        },
        () => ports.platform.findTenantUser(input.tenant, input.userId),
      );
      if (!target) throw new IamError("not_found", "Tenant user not found");
      if (target.status !== "active" || target.deletedAt) {
        throw new IamError("bad_request", "Only active tenant users can be impersonated");
      }
      if (target.id === actor.id) throw new IamError("forbidden", "Cannot impersonate yourself");
      const handoff = await bypassTenantScope(
        {
          reason: "platform IAM impersonation",
          actorId: actor.id,
          auditMeta: { tenant: input.tenant, userId: input.userId, reason },
        },
        async () => {
          const user = await ports.platform.findTenantUser(input.tenant, input.userId);
          if (!user) throw new IamError("not_found", "Tenant user not found");
          return ports.platform.issueImpersonationHandoff({
            user,
            tenant: input.tenant,
            platformActorId: actor.id,
            reason,
          });
        },
      );
      const auditId = await ports.platform.insertPlatformActivity({
        actor,
        action: "impersonate_tenant_user",
        targetResource: "tenant_user",
        targetId: `${input.tenant}:${input.userId}`,
        metadataMessage: reason,
      });
      await ports.audit.recordTenantAudit({
        tenant: input.tenant,
        actorId: actor.id,
        action: "platform.user.impersonated",
        targetId: input.userId,
        impersonatedUserId: input.userId,
        metadata: { reason, auditId },
      });
      return { handoffUrl: handoff.handoffUrl, expiresAt: handoff.expiresAt, auditId };
    },
  };
}

export type IamService = ReturnType<typeof createIamService>;
