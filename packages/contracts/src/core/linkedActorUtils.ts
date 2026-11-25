import {
  createNamedEntityLookupMap,
  normalizeIdLinkedName,
  resolveEntityName,
  type NamedEntity,
} from "../contacts/contactLinkPolicy.js";

/** Strips a denormalized actor label when the workspace user id is set. */
export function normalizeUserActorField<T extends Record<string, unknown>>(
  row: T,
  userIdField: string,
  labelField: string,
): T {
  if (!row || typeof row !== "object") return row;
  return normalizeIdLinkedName(row, userIdField, labelField);
}

/** Hydrates an actor display label from workspace users. */
export function hydrateUserActorField<T extends Record<string, unknown>>(
  row: T,
  userIdField: string,
  labelField: string,
  users: NamedEntity[] | Map<string, NamedEntity>,
): T {
  if (!row || typeof row !== "object") return row;
  const lookup =
    users instanceof Map
      ? users
      : Array.isArray(users) && users.length > 8
        ? createNamedEntityLookupMap(users)
        : users;
  const current = row[labelField];
  const resolved = resolveEntityName(row[userIdField] as string | number, lookup) || current;
  if (resolved === current) return row;
  return {
    ...row,
    [labelField]: resolved,
  };
}
