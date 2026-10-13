import { z } from "zod";
import type { AppTranslationKey } from "../i18n/appTranslations.js";
import type { Student } from "./studentTypes.js";
import { baseListQuerySchema } from "../core/apiSchemas.js";
import { isQueryFlagTrue } from "../core/paginationUtils.js";
import { isoDateSchema } from "../core/isoDateSchema.js";

export interface StudentsListQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Comma-separated status values (e.g. `active,inactive`). */
  status?: string;
  gender?: string;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  /** When true, SQL list returns deleted-only rows (Work trash). */
  includeDeleted?: boolean;
  /** Work-directory preset filter; omit or `all` means no preset. */
  quickFilter?: StudentsQuickFilter;
  /** Only students enrolled in the given session (Reports filter). */
  sessionId?: string;
  /** Only students enrolled in a session containing this class name (Reports filter). */
  className?: string;
  /** Match students sharing any of these father/guardian contact ids. */
  relatedContactIds?: string;
  /** Fallback sibling match when the father is not linked to a contact. */
  fatherName?: string;
  /** Exclude the current student from a relationship lookup. */
  excludeId?: string;
}

/** Work-directory filter presets — SSOT for schema + Filters menu. */
const STUDENTS_QUICK_FILTERS = [
  "all",
  "new",
  "missingGr",
  "active",
  "graduated",
  "transferred",
] as const;

const studentsQuickFilterSchema = z.enum(STUDENTS_QUICK_FILTERS);

/** Work-directory quick filter preset ids. */
export type StudentsQuickFilter = z.infer<typeof studentsQuickFilterSchema>;

const STUDENTS_QUICK_FILTERS_SET = new Set<string>(STUDENTS_QUICK_FILTERS);

/** Narrow a dropdown/radio string to a Students quick-filter preset. */
export function isStudentsQuickFilter(value: string): value is StudentsQuickFilter {
  return STUDENTS_QUICK_FILTERS_SET.has(value);
}

const STUDENTS_QUICK_FILTER_LABEL_KEYS = {
  all: "students.filtersAll",
  new: "students.filtersNew",
  missingGr: "students.filtersMissingGr",
  active: "students.filtersActive",
  graduated: "students.filtersGraduated",
  transferred: "students.filtersTransferred",
} as const satisfies Record<StudentsQuickFilter, AppTranslationKey>;

/** Preset options for the Students Work Filters menu. */
export const STUDENTS_QUICK_FILTER_OPTIONS: ReadonlyArray<{
  id: StudentsQuickFilter;
  labelKey: AppTranslationKey;
}> = STUDENTS_QUICK_FILTERS.map((id) => ({
  id,
  labelKey: STUDENTS_QUICK_FILTER_LABEL_KEYS[id],
}));

/** Validates Students Work list query received over HTTP (Contacts-shaped SSOT). */
export const studentsListQuerySchema = baseListQuerySchema.extend({
  status: z.string().max(200).optional(),
  gender: z.string().optional(),
  quickFilter: studentsQuickFilterSchema.optional(),
  sessionId: z.string().max(100).optional(),
  className: z.string().max(100).optional(),
  relatedContactIds: z.string().max(1000).optional(),
  fatherName: z.string().max(255).optional(),
  excludeId: z.string().max(100).optional(),
});

export interface StudentsListPageResult {
  students: Student[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

export const studentsNextGrNumberQuerySchema = z.object({
  registeredDate: isoDateSchema,
  template: z.string().max(64).optional(),
  digits: z.coerce.number().int().min(1).max(12).optional(),
  restartAnnually: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : isQueryFlagTrue(v))),
});

export type StudentsNextGrNumberQuery = z.infer<typeof studentsNextGrNumberQuerySchema>;
