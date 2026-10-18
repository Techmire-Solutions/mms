import type { Permission } from "../auth/permissions.js";
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { normalizeStoredFaculty, stripFacultyWriteNoise } from "./facultyUtils.js";
import { facultyEmployDesignationsWriteSchema } from "./facultyEmployDesignationTypes.js";
import { FACULTY_EMPLOYMENT_STATUS_VALUES, FACULTY_PROFILE_STATUS_VALUES } from "./facultyTypes.js";
import {
  FACULTY_PERFORMANCE_RATING_MAX,
  FACULTY_PERFORMANCE_RATING_MIN,
} from "./facultyPerformanceRating.js";
/** Faculty status write bound — matches lookup item max length. */
export const FACULTY_STATUS_WRITE_MAX = 200;

const facultyEmploymentWireSchema = z
  .object({
    id: z.string().optional(),
    contactId: z.union([z.string().min(1), z.number()]).optional(),
    employeeId: z.string().optional(),
    status: z.enum(FACULTY_EMPLOYMENT_STATUS_VALUES).optional(),
    employmentStartDate: isoDateSchema.nullable().optional(),
    employmentEndDate: isoDateSchema.nullable().optional(),
  })
  .optional()
  .nullable();

/**
 * Wire core keys aligned with faculty seed + audit surface.
 * Customs pass via `.catchall`; dynamic schema is `.strict()`.
 */
export const facultyCoreSchema = z
  .object({
    /** Optional on create — server assigns `{idPrefix}-{timestamp}` when omitted. */
    id: z.union([z.string(), z.number()]).optional(),
    /**
     * Nullish on the core wire schema; dynamic write schema always requires a link.
     * Empty strings are rejected.
     */
    contactId: z
      .union([z.string().min(1), z.number()])
      .nullish()
      .transform((value) => (value === null ? undefined : value)),
    employmentId: z.string().min(1).max(100).nullable().optional(),
    employeeId: z.string().optional(),
    specialization: z.string().optional(),
    /** Direct FK to the designation catalog (Department + Designation dropdown). */
    designationId: z.string().min(1).max(100).nullable().optional(),
    designationStartDate: isoDateSchema.nullable().optional(),
    designationEndDate: isoDateSchema.nullable().optional(),
    /** Read projection of the designation's department — not persisted on faculty. */
    departmentId: z.string().optional(),
    /** Read projection — not persisted on faculty. */
    department: z.string().optional(),
    /** Read projection — not persisted on faculty. */
    designation: z.string().optional(),
    parentDesignationId: z.string().nullable().optional(),
    /** Optional reports-to projection — not persisted on faculty. */
    reportingFacultyId: z.string().nullable().optional(),
    /** Read projection: designation depth in the parent chain. */
    hierarchyRank: z.coerce.number().int().min(1).max(99).optional(),
    reportingFacultyName: z.string().optional(),
    subordinateCount: z.coerce.number().int().min(0).optional(),
    /** Employment lifecycle status (Work / bulk-status). */
    status: z.enum(FACULTY_EMPLOYMENT_STATUS_VALUES).optional(),
    /** @deprecated Prefer employDesignationStatus. */
    profileStatus: z.enum(FACULTY_PROFILE_STATUS_VALUES).optional(),
    /** Employ Designation Active|Inactive. */
    employDesignationStatus: z.enum(FACULTY_PROFILE_STATUS_VALUES).optional(),
    employDesignationId: z.string().nullable().optional(),
    employDesignations: facultyEmployDesignationsWriteSchema.optional(),
    employmentStartDate: isoDateSchema.nullable().optional(),
    employmentEndDate: isoDateSchema.nullable().optional(),
    /** Nested employment satellite (optional; flat fields remain dual-write mirrors). */
    employment: facultyEmploymentWireSchema,
    /** Server-computed from evaluation ratings; client writes are ignored. */
    performanceRating: z.coerce
      .number()
      .min(FACULTY_PERFORMANCE_RATING_MIN)
      .max(FACULTY_PERFORMANCE_RATING_MAX)
      .nullable()
      .optional(),
    /** @deprecated Legacy join date; `employmentStartDate` is authoritative. */
    joinDate: z.string().optional(),
    qualification: z.string().optional(),
    notes: z.string().optional(),
    userId: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    createdBy: z.string().optional(),
    updatedBy: z.string().optional(),
  })
  .catchall(z.unknown());

/** Wire create/update parse — shared write-noise strip + normalize (Contacts SSOT). */
export const facultyRecordSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    return stripFacultyWriteNoise({ ...(raw as Record<string, unknown>) });
  },
  facultyCoreSchema.transform((record) => normalizeStoredFaculty(record)),
);

/** POST /api/faculty/bulk-status body — targets employment lifecycle status. */
export const facultyBulkStatusSchema = z.object({
  ids: z
    .array(z.union([z.string(), z.number()]))
    .min(1)
    .max(500),
  status: z.enum(FACULTY_EMPLOYMENT_STATUS_VALUES),
});

/** POST /api/faculty/bulk-specialization body. */
export const facultyBulkSpecializationSchema = z.object({
  ids: z
    .array(z.union([z.string(), z.number()]))
    .min(1)
    .max(500),
  specialization: z.string().min(1).max(150),
});

export type FacultyBulkSpecializationBody = z.infer<typeof facultyBulkSpecializationSchema>;

/** GET /api/faculty/next-employee-id query. */
export const facultyNextEmployeeIdQuerySchema = z.object({
  prefix: z.string().max(32).optional(),
  template: z.string().max(64).optional(),
  digits: z.coerce.number().int().min(1).max(8).optional(),
  startSeq: z.coerce.number().int().min(1).optional(),
  restartAnnually: z.coerce.boolean().optional(),
});

export const facultyListSchema = z
  .array(facultyCoreSchema)
  .transform((list) => list.map((record) => normalizeStoredFaculty(record)));

export type FacultyRecord = z.infer<typeof facultyCoreSchema>;

/** Faculty module manifest — aligns with globle1 universal module architecture. */
export const FACULTY_MODULE_MANIFEST = {
  moduleId: "faculty",
  entityType: "FacultyMember",
  collectionKey: "faculty",
  /** Legacy remap / backup key — typed field-config lives on `faculty_field_configs`. */
  settingsObjectKey: "faculty_settings",
  configObjectKey: "faculty_field_config",
  preferencesObjectKey: "faculty_module_preferences",
  columnPreferencesObjectKey: "faculty_user_column_preferences",
  restBasePath: "/api/faculty",
  analyticsCategory: "faculty",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["preferences"] as const,
  permissions: {
    read: "faculty.read",
    write: "faculty.write",
    delete: "faculty.delete",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    export: "faculty.read",
    reports: "faculty.read",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["table", "cards"] as const,
    bulkActions: [
      "whatsapp",
      "sms",
      "email",
      "idCards",
      "export",
      "delete",
      "status",
      "specialization",
    ] as const,
  },
  defaultExportFilename: "faculty.csv",
  searchableFieldKeys: [
    "name",
    "employeeId",
    "phone",
    "email",
    "specialization",
    "department",
    "designation",
  ] as const,
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    /** Active Work exports exclude trash; Work trash UI omits export CTAs. */
    exportsIncludeDeleted: false,
    captureDeletionReason: true,
    retentionDays: null,
  },
  /** Server CSV export page-walk size (rows per streamed chunk). */
  exportChunkSize: 100,
  /** Default Work directory page size when using server pagination (globle1 §10). */
  defaultPageSize: 50,
  maxPageSize: 100,
} as const;

export type FacultyModuleTier = (typeof FACULTY_MODULE_MANIFEST.tiers)[number];
