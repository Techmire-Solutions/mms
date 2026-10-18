import { z } from "zod";

export const SESSION_LOOKUP_KINDS = ["statuses", "types"] as const;

export type SessionLookupKind = (typeof SESSION_LOOKUP_KINDS)[number];

/** Legacy document-store collection key → typed lookup kind. */
export const SESSION_LOOKUP_LEGACY_COLLECTION_KEYS = {
  sessionStatuses: "statuses",
  sessionTypes: "types",
} as const satisfies Record<string, SessionLookupKind>;

export type SessionLookupLegacyCollectionKey = keyof typeof SESSION_LOOKUP_LEGACY_COLLECTION_KEYS;

export type SessionLookupsMap = {
  statuses: string[];
  types: string[];
};

export const DEFAULT_SESSION_STATUSES = ["active", "upcoming", "completed", "cancelled"] as const;

export const DEFAULT_SESSION_TYPES = [
  "Hifz",
  "Qaidah",
  "Tajweed",
  "Islamic Studies",
  "Arabic",
  "Other",
] as const;

export const defaultSessionLookupItems: SessionLookupsMap = {
  statuses: [...DEFAULT_SESSION_STATUSES],
  types: [...DEFAULT_SESSION_TYPES],
};

export const emptySessionLookupsMap: SessionLookupsMap = {
  statuses: [],
  types: [],
};

export const sessionLookupKindSchema = z.enum(SESSION_LOOKUP_KINDS);

export const sessionLookupStringItemsSchema = z.array(z.string().min(1).max(200)).max(500);

export const sessionLookupsMapSchema = z.object({
  statuses: sessionLookupStringItemsSchema,
  types: sessionLookupStringItemsSchema,
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
