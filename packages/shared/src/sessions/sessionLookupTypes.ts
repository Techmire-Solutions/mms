import { z } from "zod";

// `types` was removed by migration 0182: Programs own session types now, and release A
// migrated every custom label into the programs catalog.
export const SESSION_LOOKUP_KINDS = ["statuses"] as const;

export type SessionLookupKind = (typeof SESSION_LOOKUP_KINDS)[number];

/** Legacy document-store collection key → typed lookup kind. */
export const SESSION_LOOKUP_LEGACY_COLLECTION_KEYS = {
  sessionStatuses: "statuses",
} as const satisfies Record<string, SessionLookupKind>;

export type SessionLookupLegacyCollectionKey = keyof typeof SESSION_LOOKUP_LEGACY_COLLECTION_KEYS;

export type SessionLookupsMap = {
  statuses: string[];
};

export const DEFAULT_SESSION_STATUSES = ["active", "upcoming", "completed", "cancelled"] as const;

export const defaultSessionLookupItems: SessionLookupsMap = {
  statuses: [...DEFAULT_SESSION_STATUSES],
};

export const emptySessionLookupsMap: SessionLookupsMap = {
  statuses: [],
};

export const sessionLookupKindSchema = z.enum(SESSION_LOOKUP_KINDS);

export const sessionLookupStringItemsSchema = z.array(z.string().min(1).max(200)).max(500);

export const sessionLookupsMapSchema = z.object({
  statuses: sessionLookupStringItemsSchema,
});

export const sessionLookupKindParamsSchema = z.object({
  kind: sessionLookupKindSchema,
});

export const sessionLookupPutBodySchema = z.object({
  items: sessionLookupStringItemsSchema,
});

export function isSessionLookupLegacyCollectionKey(
  value: string,
): value is SessionLookupLegacyCollectionKey {
  return Object.prototype.hasOwnProperty.call(SESSION_LOOKUP_LEGACY_COLLECTION_KEYS, value);
}
