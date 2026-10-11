import { z } from "zod";
import type { AppTranslationKey } from "./appTranslations.js";
import { baseListQuerySchema } from "./apiSchemas.js";
import type { Contact } from "./contactTypes.js";
import { contactMatchesSearch } from "./contactsSearchUtils.js";
import { filterActiveContacts, isContactDeleted } from "./contactSoftDelete.js";
import { getPrimaryEmail, getPrimaryPhone, hasWhatsApp } from "./utils.js";

/** Work-directory filter presets — SSOT for schema + Filters menu. */
export const CONTACTS_QUICK_FILTERS = ["all", "whatsapp", "syed", "missingInfo", "recent"] as const;

const contactsQuickFilterSchema = z.enum(CONTACTS_QUICK_FILTERS);

/** Work-directory quick filter preset ids. */
export type ContactsQuickFilter = z.infer<typeof contactsQuickFilterSchema>;

const CONTACTS_QUICK_FILTERS_SET = new Set<string>(CONTACTS_QUICK_FILTERS);

/** Narrow a dropdown/radio string to a Contacts quick-filter preset. */
export function isContactsQuickFilter(value: string): value is ContactsQuickFilter {
  return CONTACTS_QUICK_FILTERS_SET.has(value);
}

const CONTACTS_QUICK_FILTER_LABEL_KEYS = {
  all: "contacts.filtersAll",
  whatsapp: "contacts.filtersWhatsApp",
  syed: "contacts.filtersSyed",
  missingInfo: "contacts.filtersMissingInfo",
  recent: "contacts.filtersRecent",
} as const satisfies Record<ContactsQuickFilter, AppTranslationKey>;

/** Preset options for the Contacts Work Filters menu. */
export const CONTACTS_QUICK_FILTER_OPTIONS: ReadonlyArray<{
  id: ContactsQuickFilter;
  labelKey: AppTranslationKey;
}> = CONTACTS_QUICK_FILTERS.map((id) => ({
  id,
  labelKey: CONTACTS_QUICK_FILTER_LABEL_KEYS[id],
}));

const booleanQueryFlag = z
  .preprocess((value) => {
    if (value === undefined) return undefined;
    return value === "true" || value === true;
  }, z.boolean())
  .optional();

/** Validates and transforms the contacts list query received over HTTP. */
export const contactsListQuerySchema = baseListQuerySchema.extend({
  gender: z.string().optional(),
  hasPhone: booleanQueryFlag,
  hasEmail: booleanQueryFlag,
  hasReachable: booleanQueryFlag,
  quickFilter: contactsQuickFilterSchema.optional(),
  excludeIds: z
    .string()
    .max(4000)
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : undefined,
    ),
  excludeLinkedModules: z
    .string()
    .optional()
    .transform((value) => {
      if (!value?.trim()) return undefined;
      const allowed = new Set(["students", "faculty"]);
      const modules = value
        .split(",")
        .map((part) => part.trim())
        .filter((part): part is "students" | "faculty" => allowed.has(part));
      return modules.length > 0 ? modules : undefined;
    }),
});

/**
 * Programmatic contacts query used after wire values have been transformed.
 * Its shared fields align with `contactsListQuerySchema` (including `hasEmail`).
 * The backend list router normalizes `includeDeleted`.
 */
export interface ContactsListQuery {
  page?: number;
  limit?: number;
  search?: string;
  gender?: string;
  includeDeleted?: boolean;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  hasPhone?: boolean;
  /** Primary email present — messaging “select all with email”. */
  hasEmail?: boolean;
  /** Phone or email present — messaging Work recipient lists. */
  hasReachable?: boolean;
  /** Toolbar quick filter; omit or `all` means no preset. */
  quickFilter?: ContactsQuickFilter;
  /** Contact ids to omit from results (picker already-linked exclusions). */
  excludeIds?: Array<string | number>;
  /**
   * Restrict results to these contact ids.
   * Empty array means no matches — do not confuse with omitted (no id restriction).
   */
  includeIds?: Array<string | number>;
  /**
   * SQL-only: EXISTS / NOT EXISTS against module link tables (no id materialization).
   * Prefer over large `includeIds` / `excludeIds` for messaging role scopes.
   */
  moduleLinkFilter?: "students" | "faculty" | "staff" | "unlinked";
  /**
   * SQL-only: omit contacts linked to these modules (NOT EXISTS per module).
   * Prefer over a large `excludeIds` query string.
   */
  excludeLinkedModules?: Array<"students" | "faculty">;
  /** Keyset pagination: fetch items after this primary key */
  afterId?: string;
  /** Performance optimization: skip counting total rows when only iterating pages */
  skipCount?: boolean;
  /** Full child table hydration (education, experience, skills, bank details, activities, attachments) for exports */
  fullHydration?: boolean;
}

export interface ContactsListPageResult {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

function matchesContactsQuickFilter(
  contact: Contact,
  quickFilter: ContactsQuickFilter | undefined,
  referenceDate = new Date(),
): boolean {
  if (!quickFilter || quickFilter === "all") return true;
  if (quickFilter === "whatsapp") return hasWhatsApp(contact);
  if (quickFilter === "syed") return Boolean(contact.isSyed);
  if (quickFilter === "missingInfo") return !getPrimaryPhone(contact) || !getPrimaryEmail(contact);
  if (quickFilter === "recent") {
    if (!contact.createdAt) return false;
    const created = new Date(contact.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    const cutoffTime = referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000;
    return created.getTime() >= cutoffTime;
  }
  return true;
}

export function filterContactsForQuery(
  contacts?: Contact[] | null,
  query?: ContactsListQuery | null,
): Contact[] {
  if (!Array.isArray(contacts) || !query) return [];
  let rows = (
    query.includeDeleted ? contacts.filter(isContactDeleted) : filterActiveContacts(contacts)
  ).filter(Boolean);
  if (query.gender) {
    const genderFilter = query.gender.trim().toLowerCase();
    rows = rows.filter((contact) => {
      const gender = (contact.gender ?? "").trim().toLowerCase();
      if (genderFilter === "unspecified") return !gender || gender === "unspecified";
      return gender === genderFilter;
    });
  }
  if (query.hasPhone) {
    rows = rows.filter((contact) => Boolean(getPrimaryPhone(contact)));
  }
  if (query.hasEmail) {
    rows = rows.filter((contact) => Boolean(getPrimaryEmail(contact)));
  }
  if (query.hasReachable) {
    rows = rows.filter(
      (contact) => Boolean(getPrimaryPhone(contact)) || Boolean(getPrimaryEmail(contact)),
    );
  }
  if (query.quickFilter && query.quickFilter !== "all") {
    const refDate = new Date();
    rows = rows.filter((contact) =>
      matchesContactsQuickFilter(contact, query.quickFilter, refDate),
    );
  }
  if (query.excludeIds && query.excludeIds.length > 0) {
    const excluded = new Set(query.excludeIds.map(String));
    rows = rows.filter((contact) => !excluded.has(String(contact.id)));
  }
  if (query.includeIds) {
    const included = new Set(query.includeIds.map(String));
    rows = rows.filter((contact) => included.has(String(contact.id)));
  }
  if (query.search?.trim()) {
    rows = rows.filter((contact) => contactMatchesSearch(contact, query.search!));
  }
  return rows;
}
