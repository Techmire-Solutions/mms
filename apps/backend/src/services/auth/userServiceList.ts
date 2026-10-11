import {
  createContactLookupMap,
  hydrateWorkspaceUserProfile,
  resolveTenantLoginEmail,
} from "@mms/shared";
import {
  findTenantUserRowById,
  upsertTenantUsersBatch,
} from "../../db/repositories/tenantUserRepository.js";
import { hashPassword } from "./passwordService.js";
import {
  getContactsForUsers,
  getRawUsers,
  requireTenantSubdomain,
  type IncomingUser,
  type PersistedUser,
  type TenantUserRow,
} from "./userServiceShared.js";

export async function getHydratedUsers(options?: {
  includeDeleted?: boolean;
}): Promise<PersistedUser[]> {
  const users = await getRawUsers(options);
  const contacts = await getContactsForUsers(users);
  const contactMap = createContactLookupMap(contacts);
  return users.map((user) => hydrateWorkspaceUserProfile(user, contactMap) as PersistedUser);
}

export async function saveUsers(next: PersistedUser[]): Promise<void> {
  const subdomain = requireTenantSubdomain();
  const existingUsers = await getRawUsers();
  const existingById = new Map(existingUsers.map((user) => [String(user.id), user]));
  const prepared = await Promise.all(
    next.map(async (user) => {
      const incoming = user as IncomingUser;
      const existing = existingById.get(String(incoming.id));
      const temporaryPassword = incoming.temporaryPassword?.trim();
      const passwordHash = temporaryPassword
        ? await hashPassword(temporaryPassword)
        : typeof incoming.passwordHash === "string" && incoming.passwordHash
          ? incoming.passwordHash
          : typeof existing?.passwordHash === "string"
            ? existing.passwordHash
            : "";
      const loginEmail =
        resolveTenantLoginEmail(
          incoming,
          typeof incoming.email === "string" ? incoming.email : undefined,
        ) ||
        resolveTenantLoginEmail(
          existing ?? {},
          typeof existing?.email === "string" ? existing.email : undefined,
        );
      const mustChangePassword = temporaryPassword
        ? incoming.mustChangePassword !== false
        : (incoming.mustChangePassword ?? existing?.mustChangePassword ?? false);
      const { temporaryPassword: _temporaryPassword, ...rest } = incoming;
      void _temporaryPassword;
      return {
        ...rest,
        workspaceSubdomain: subdomain,
        loginEmail,
        passwordHash,
        mustChangePassword,
      };
    }),
  );
  // Upsert-only: never wipe soft-deleted (or other) rows missing from the payload.
  await upsertTenantUsersBatch(subdomain, prepared as TenantUserRow[]);
}

export async function getWorkspaceUserRow(userId: string): Promise<PersistedUser | undefined> {
  const users = await getHydratedUsers();
  return users.find((entry) => entry.id === userId);
}

export async function getLinkedContactId(userId: string): Promise<string | number | null> {
  const user = await findTenantUserRowById(requireTenantSubdomain(), userId);
  const contactId = user?.contactId;
  if (contactId == null || contactId === "") return null;
  return contactId;
}
