import type { UsersRepository } from "../repository/usersRepository.js";
import { usersRepository } from "../repository/usersRepositoryAdapter.js";
import { getRequestTenant, requireTenant } from "../../lib/tenantContext.js";
import { getHydratedUsers } from "../../services/auth/userService.js";
import { loadContactsByIds } from "../../services/contactService.js";
import {
  type WorkspaceUser,
  type UsersListQuery,
  type UsersListPageResult,
  type CreateWorkspaceUserInput,
  type EditWorkspaceUserInput,
  type InviteWorkspaceUserInput,
  normalizeWorkspaceUser,
  createContactLookupMap,
  hydrateWorkspaceUserProfile,
  dedupeTrimmedIds,
} from "@mms/shared";
import { createUserActivityLogService } from "./userActivityLogUseCases.js";
import {
  executeUserPasswordReset,
  type UserPasswordResetFailureStage,
  type UserPasswordResetAuxiliaryStage,
  type UserPasswordResetAuxiliaryErrorHandler,
  UserPasswordResetError,
  runPasswordResetStage,
  runPasswordResetAuxiliaryStep,
} from "./userPasswordUseCases.js";
import { createWorkspaceUserHelper, inviteWorkspaceUserHelper } from "./userCreationUseCases.js";
import {
  deleteUserByIdHelper,
  restoreUserByIdHelper,
  verifyUserEmailByIdHelper,
  upsertWorkspaceUsersHelper,
  updateWorkspaceUserHelper,
} from "./userMutationUseCases.js";

export type {
  UserPasswordResetFailureStage,
  UserPasswordResetAuxiliaryStage,
  UserPasswordResetAuxiliaryErrorHandler,
};
export { UserPasswordResetError, runPasswordResetStage, runPasswordResetAuxiliaryStep };

/**
 * Users use-cases — composition root binding a {@link UsersRepository} to every
 * operation. Production uses the default Drizzle-backed `usersUseCases`; tests
 * can pass a fake repository to exercise orchestration in isolation.
 */
export function createUsersUseCases(repo: UsersRepository = usersRepository) {
  const logService = createUserActivityLogService(repo);

  async function hydrateUserRows(
    rows: Awaited<ReturnType<UsersRepository["listTenantUsersByIds"]>>,
  ): Promise<WorkspaceUser[]> {
    const contactIds = [
      ...new Set(
        rows
          .map((row) => row.contactId)
          .filter((id): id is string | number => id != null && id !== "")
          .map(String),
      ),
    ];
    const contacts = contactIds.length > 0 ? await loadContactsByIds(contactIds) : [];
    const contactMap = createContactLookupMap(contacts);
    return rows.map((row) =>
      normalizeWorkspaceUser(
        hydrateWorkspaceUserProfile(row, contactMap) as Partial<WorkspaceUser>,
      ),
    );
  }

  const loadWorkspaceUsers = async (options?: {
    includeDeleted?: boolean;
  }): Promise<WorkspaceUser[]> => {
    const users = await getHydratedUsers({ includeDeleted: options?.includeDeleted });
    return users.map((u) => normalizeWorkspaceUser(u));
  };

  const createWorkspaceUser = (
    input: (CreateWorkspaceUserInput | WorkspaceUser) & Record<string, unknown>,
    actorId: string,
    actorRole?: string,
    ip = "127.0.0.1",
    origin?: string,
  ) => createWorkspaceUserHelper(repo, input, actorId, actorRole, ip, origin, loadWorkspaceUsers);

  const deleteUserById = (id: string, deletedBy: string, actorRole?: string, ip = "127.0.0.1") =>
    deleteUserByIdHelper(repo, id, deletedBy, actorRole, ip);

  const restoreUserById = (
    id: string,
    actorRole?: string,
    actorId = "system",
    ip = "127.0.0.1",
  ) => restoreUserByIdHelper(repo, id, actorRole, actorId, ip);

  return {
    loadUsersPage: async (
      query: UsersListQuery & { includeDeleted?: boolean },
    ): Promise<UsersListPageResult> => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          users: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 50,
          hasMore: false,
        };
      }
      const page = await repo.listTenantUsersPage(tenant, query);
      const ids = page.rows.map((row) => String(row.id));
      const rows = ids.length > 0 ? await repo.listTenantUsersByIds(tenant, ids) : [];
      const byId = new Map(rows.map((row) => [String(row.id), row]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof rows;
      const users = await hydrateUserRows(ordered);
      return {
        users,
        total: page.total,
        page: page.page,
        limit: page.limit,
        hasMore: page.hasMore,
      };
    },

    loadUsersByIds: async (ids: string[], includeDeleted = false): Promise<WorkspaceUser[]> => {
      const uniqueIds = dedupeTrimmedIds(ids);
      if (uniqueIds.length === 0) return [];
      const tenant = requireTenant();
      const rows = await repo.listTenantUsersByIds(tenant, uniqueIds);
      const filtered = includeDeleted ? rows : rows.filter((r) => !r.deletedAt);
      return hydrateUserRows(filtered);
    },

    loadUserById: async (id: string, includeDeleted = false): Promise<WorkspaceUser | null> => {
      const cleanId = id?.trim();
      if (!cleanId) return null;
      const tenant = requireTenant();
      const rows = await repo.listTenantUsersByIds(tenant, [cleanId]);
      const row = rows[0];
      if (!row) return null;
      if (!includeDeleted && row.deletedAt) return null;
      const [user] = await hydrateUserRows([row]);
      return user ?? null;
    },

    countUsers: async (): Promise<number> => {
      const tenant = getRequestTenant();
      if (!tenant) return 0;
      return repo.countTenantUsersActive(tenant);
    },

    loadUsersCommandMetrics: async () => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          total: 0,
          active: 0,
          suspended: 0,
          admins: 0,
          twoFaEnabled: 0,
          activeSessions: 0,
        };
      }
      return repo.aggregateUsersCommandMetrics(tenant);
    },

    // --- Users ---
    loadWorkspaceUsers,

    upsertWorkspaceUsers: (records: WorkspaceUser[], actorRole?: string) =>
      upsertWorkspaceUsersHelper(records, actorRole, loadWorkspaceUsers),

    createWorkspaceUser,

    updateWorkspaceUser: (
      id: string,
      input: Partial<EditWorkspaceUserInput> & Record<string, unknown>,
      actorId: string,
      actorRole?: string,
      ip = "127.0.0.1",
    ) => updateWorkspaceUserHelper(repo, id, input, actorId, actorRole, ip, loadWorkspaceUsers),

    inviteWorkspaceUser: (
      input: InviteWorkspaceUserInput,
      actorId: string,
      actorRole?: string,
      ip = "127.0.0.1",
      origin?: string,
    ) => inviteWorkspaceUserHelper(createWorkspaceUser, input, actorId, actorRole, ip, origin),

    deleteUserById,

    restoreUserById,

    verifyUserEmailById: (id: string, actorRole?: string) =>
      verifyUserEmailByIdHelper(repo, id, actorRole),

    resetUserPasswordById: async (
      id: string,
      temporaryPassword: string,
      actorRole?: string,
      actorId = "system",
      ip = "127.0.0.1",
      onAuxiliaryError?: UserPasswordResetAuxiliaryErrorHandler,
    ): Promise<boolean> =>
      executeUserPasswordReset(repo, {
        id,
        temporaryPassword,
        actorRole,
        actorId,
        ip,
        onAuxiliaryError,
      }),

    bulkSoftDeleteUsers: async (
      ids: string[],
      deletedBy: string,
      actorRole?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      let succeeded = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          const ok = await deleteUserById(id, deletedBy, actorRole);
          if (ok) succeeded += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
      return { succeeded, failed };
    },

    bulkRestoreUsers: async (
      ids: string[],
      actorRole?: string,
      actorId = "system",
      ip = "127.0.0.1",
    ): Promise<{ succeeded: number; failed: number }> => {
      let succeeded = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          const ok = await restoreUserById(id, actorRole, actorId, ip);
          if (ok) succeeded += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
      return { succeeded, failed };
    },

    // --- Activity Logs ---
    loadLogs: logService.loadLogs,
    loadLogById: logService.loadLogById,
    loadLogsByIds: logService.loadLogsByIds,
    saveLog: logService.saveLog,
    upsertLogs: logService.upsertLogs,
  };
}

export const usersUseCases = createUsersUseCases();
