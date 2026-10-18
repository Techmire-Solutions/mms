import { z } from "zod";
import type { AppTranslationKey } from "../i18n/appTranslations.js";
import { baseListQueryFields } from "../core/apiSchemas.js";
import {
  FACULTY_SORT_FIELDS,
  FACULTY_SORT_FIELD_SET,
  type FacultySortField,
} from "./facultyDirectoryColumns.js";
import { resolveFacultyStatusRoles, type Faculty } from "./facultyTypes.js";

export { FACULTY_SORT_FIELDS, FACULTY_SORT_FIELD_SET, type FacultySortField };

/** Work-directory filter presets — SSOT for schema + Filters menu. */
export const FACULTY_QUICK_FILTERS = [
  "all",
  "active",
  "inactive",
  "onLeave",
  "missingEmployeeId",
] as const;

const facultyQuickFilterSchema = z.enum(FACULTY_QUICK_FILTERS);

/** Work-directory quick filter preset ids. */
export type FacultyQuickFilter = z.infer<typeof facultyQuickFilterSchema>;

const FACULTY_QUICK_FILTERS_SET = new Set<string>(FACULTY_QUICK_FILTERS);

/** Narrow a dropdown/radio string to a Faculty quick-filter preset. */
export function isFacultyQuickFilter(value: string): value is FacultyQuickFilter {
  return FACULTY_QUICK_FILTERS_SET.has(value);
}

const FACULTY_QUICK_FILTER_LABEL_KEYS = {
  all: "faculty.filtersAll",
  active: "faculty.filtersActive",
  inactive: "faculty.filtersInactive",
  onLeave: "faculty.filtersOnLeave",
  missingEmployeeId: "faculty.filtersMissingEmployeeId",
} as const satisfies Record<FacultyQuickFilter, AppTranslationKey>;

/** Preset options for the Faculty Work Filters menu. */
export const FACULTY_QUICK_FILTER_OPTIONS: ReadonlyArray<{
  id: FacultyQuickFilter;
  labelKey: AppTranslationKey;
}> = FACULTY_QUICK_FILTERS.map((id) => ({
  id,
  labelKey: FACULTY_QUICK_FILTER_LABEL_KEYS[id],
}));

const FACULTY_QUICK_FILTER_STATUS_VALUES = (() => {
  const roles = resolveFacultyStatusRoles();
  return { active: roles.active, inactive: roles.inactive, onLeave: roles.onLeave } as const;
})();

/**
 * Stored faculty status value for a status quick-filter preset id
 * (e.g. `onLeave` → `on_leave`); `undefined` for non-status presets.
 */
export function facultyQuickFilterStatusValue(preset: FacultyQuickFilter): string | undefined {
  if (preset === "all" || preset === "missingEmployeeId") return undefined;
  return FACULTY_QUICK_FILTER_STATUS_VALUES[preset];
}

/** Validates Faculty Work list query received over HTTP (SQL page is authoritative). */
export const facultyListQuerySchema = z.object({
  ...baseListQueryFields,
  status: z.string().optional(),
  specialization: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  reportingFacultyId: z.string().optional(),
  gender: z.string().optional(),
  quickFilter: facultyQuickFilterSchema.optional(),
  sortField: z.enum(FACULTY_SORT_FIELDS).optional(),
});

/** Zod-inferred HTTP list query (includeDeleted is `'true' | 'false'` from base). */
export type FacultyListQueryParsed = z.infer<typeof facultyListQuerySchema>;

/**
 * Service / FE Query / SQL list query — Zod wire fields with boolean `includeDeleted`
 * after HTTP normalize (same authority as {@link facultyListQuerySchema}).
 */
export type FacultyListQuery = Omit<FacultyListQueryParsed, "includeDeleted" | "skipCount"> & {
  includeDeleted?: boolean;
  skipCount?: boolean;
};

/** Server SQL page result shape (FE Query + BE repository). */
export interface FacultyListPageResult {
  faculty: Faculty[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}
