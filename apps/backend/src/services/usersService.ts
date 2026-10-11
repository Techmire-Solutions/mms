import { usersUseCases } from "../users/use-cases/usersUseCases.js";

/**
 * Thin re-export of the users use-cases facade.
 *
 * Kept for backward compatibility with existing importers (contract router,
 * tests). New code should depend on `users/use-cases/usersUseCases.js` directly.
 */
export const loadUsersPage = usersUseCases.loadUsersPage;
export const loadUsersByIds = usersUseCases.loadUsersByIds;
export const loadUserById = usersUseCases.loadUserById;
export const countUsers = usersUseCases.countUsers;
export const loadUsersCommandMetrics = usersUseCases.loadUsersCommandMetrics;
export const loadWorkspaceUsers = usersUseCases.loadWorkspaceUsers;
export const upsertWorkspaceUsers = usersUseCases.upsertWorkspaceUsers;
export const createWorkspaceUser = usersUseCases.createWorkspaceUser;
export const updateWorkspaceUser = usersUseCases.updateWorkspaceUser;
export const inviteWorkspaceUser = usersUseCases.inviteWorkspaceUser;
export const deleteUserById = usersUseCases.deleteUserById;
export const restoreUserById = usersUseCases.restoreUserById;
export const verifyUserEmailById = usersUseCases.verifyUserEmailById;
export const resetUserPasswordById = usersUseCases.resetUserPasswordById;
export const bulkSoftDeleteUsers = usersUseCases.bulkSoftDeleteUsers;
export const bulkRestoreUsers = usersUseCases.bulkRestoreUsers;
export const loadLogs = usersUseCases.loadLogs;
export const loadLogById = usersUseCases.loadLogById;
export const loadLogsByIds = usersUseCases.loadLogsByIds;
export const saveLog = usersUseCases.saveLog;
export const upsertLogs = usersUseCases.upsertLogs;
