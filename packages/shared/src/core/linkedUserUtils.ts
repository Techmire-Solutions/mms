import {
  createContactLookupMap,
  createNamedEntityLookupMap,
  hydrateContactProfile,
  normalizeContactLinkedRecord,
  normalizeIdLinkedName,
  resolveEntityName,
  type ContactLike,
  type NamedEntity,
} from "../contacts/contactLinkPolicy.js";

export function stripWorkspaceUserProfileFields<T extends Record<string, unknown>>(user: T): T {
  if (!user || typeof user !== "object") return user;
  return normalizeContactLinkedRecord(user);
}

export function hydrateWorkspaceUserProfile<T extends Record<string, unknown>>(
  user: T,
  contacts: ContactLike[] | Map<string, ContactLike>,
): T {
  if (!user || typeof user !== "object") return user;
  const lookup =
    contacts instanceof Map
      ? contacts
      : Array.isArray(contacts) && contacts.length > 8
        ? createContactLookupMap(contacts)
        : contacts;
  const hydrated = hydrateContactProfile(user, lookup);
  const name = String(hydrated.name ?? "").trim();
  if (name && !hydrated.avatarInitials) {
    const spaceIdx = name.indexOf(" ");
    const initials =
      spaceIdx > 0
        ? (name[0] + (name[spaceIdx + 1] ?? "")).toUpperCase()
        : name.slice(0, 2).toUpperCase();
    return {
      ...hydrated,
      avatarInitials: initials,
    };
  }
  return hydrated;
}

export function hydrateWorkspaceUserProfileList<T extends Record<string, unknown>>(
  rows: T[],
  contacts: ContactLike[] | Map<string, ContactLike>,
): T[] {
  if (!rows || !Array.isArray(rows)) return [];
  const contactLookup =
    contacts instanceof Map
      ? contacts
      : contacts.length > 8
        ? createContactLookupMap(contacts)
        : contacts;
  return rows.map((r) => hydrateWorkspaceUserProfile(r, contactLookup));
}

export function normalizeActivityLog<T extends Record<string, unknown>>(log: T): T {
  if (!log || typeof log !== "object") return log;
  return normalizeIdLinkedName(log, "userId", "userName");
}

export function hydrateActivityLog<T extends Record<string, unknown>>(
  log: T,
  users: NamedEntity[] | Map<string, NamedEntity>,
): T {
  if (!log || typeof log !== "object") return log;
  const current = log.userName;
  const lookup =
    users instanceof Map
      ? users
      : Array.isArray(users) && users.length > 8
        ? createNamedEntityLookupMap(users)
        : users;
  const resolved = resolveEntityName(log.userId as string | number, lookup) || current;
  if (resolved === current) return log;
  return {
    ...log,
    userName: resolved,
  };
}

export function hydrateActivityLogList<T extends Record<string, unknown>>(
  rows: T[],
  users: NamedEntity[] | Map<string, NamedEntity>,
): T[] {
  if (!rows || !Array.isArray(rows)) return [];
  const userLookup =
    users instanceof Map ? users : users.length > 8 ? createNamedEntityLookupMap(users) : users;
  return rows.map((r) => hydrateActivityLog(r, userLookup));
}
