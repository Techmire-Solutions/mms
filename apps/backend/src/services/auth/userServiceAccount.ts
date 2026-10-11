import { resolveTenantLoginEmail, type Contact } from "@mms/shared";
import { findTenantUserRowById } from "../../db/repositories/tenantUserRepository.js";
import { updateContactById } from "../contactService.js";
import { assertPasswordMeetsPolicy } from "../globalSettingsService.js";
import { hashPassword, verifyPassword } from "./passwordService.js";
import {
  getRawUsers,
  requireTenantSubdomain,
  type PersistedUser,
  type PublicUser,
} from "./userServiceShared.js";
import { getLinkedContactId, saveUsers } from "./userServiceList.js";
import { getPublicUserById } from "./userServiceAuth.js";

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  const row = await findTenantUserRowById(requireTenantSubdomain(), userId);
  if (row?.deletedAt) return false;
  const passwordHash = typeof row?.passwordHash === "string" ? row.passwordHash : "";
  if (!passwordHash) {
    const users = await getRawUsers();
    const legacy = users.find((u) => u.id === userId);
    const legacyHash = typeof legacy?.passwordHash === "string" ? legacy.passwordHash : "";
    if (!legacyHash) return false;
    return verifyPassword(password, legacyHash);
  }
  return verifyPassword(password, passwordHash);
}

export async function changeTenantUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const users = await getRawUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index < 0) throw new Error("User not found");

  const row = users[index];
  const passwordHash = typeof row.passwordHash === "string" ? row.passwordHash : "";
  if (!passwordHash || !(await verifyPassword(currentPassword, passwordHash))) {
    const err = new Error("Current password is incorrect") as Error & {
      statusCode?: number;
      type?: string;
    };
    err.statusCode = 401;
    err.type = "invalid_credentials";
    throw err;
  }

  await assertPasswordMeetsPolicy(newPassword);
  users[index] = {
    ...row,
    passwordHash: await hashPassword(newPassword),
    mustChangePassword: false,
  };
  await saveUsers(users);
}

export async function setTenantLoginEmail(
  userId: string,
  loginEmail: string,
): Promise<PublicUser | null> {
  const normalized = loginEmail.trim().toLowerCase();
  const users = await getRawUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index < 0) return null;

  const subdomain =
    typeof users[index].workspaceSubdomain === "string" ? users[index].workspaceSubdomain! : "";
  const conflict = users.some(
    (u, i) =>
      i !== index &&
      u.workspaceSubdomain === subdomain &&
      resolveTenantLoginEmail(u) === normalized,
  );
  if (conflict) {
    const err = new Error("Login email is already in use") as Error & {
      statusCode?: number;
      type?: string;
    };
    err.statusCode = 409;
    err.type = "conflict";
    throw err;
  }

  const next: PersistedUser = {
    ...users[index],
    loginEmail: normalized,
    emailVerifiedAt: new Date().toISOString(),
    pendingLoginEmail: undefined,
  };
  delete next.email;
  users[index] = next;
  await saveUsers(users);

  return getPublicUserById(userId);
}

export async function setPendingLoginEmail(
  userId: string,
  pendingLoginEmail: string | undefined,
): Promise<void> {
  const users = await getRawUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index < 0) return;
  const next = { ...users[index] };
  if (pendingLoginEmail) {
    next.pendingLoginEmail = pendingLoginEmail.trim().toLowerCase();
  } else {
    delete next.pendingLoginEmail;
  }
  users[index] = next;
  await saveUsers(users);
}

export async function updateOwnLinkedContact(
  userId: string,
  contact: Contact,
): Promise<Contact | null> {
  const contactId = await getLinkedContactId(userId);
  if (contactId == null) {
    const err = new Error("No linked contact for this account") as Error & {
      statusCode?: number;
      type?: string;
    };
    err.statusCode = 400;
    err.type = "no_contact_link";
    throw err;
  }
  // Own-profile updates never rewrite peer relationship graphs.
  return updateContactById(
    String(contactId),
    { ...contact, id: contactId },
    { applyRelationshipInference: false },
  );
}
