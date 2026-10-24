import type { Permission } from "../auth/permissions.js";
import { z } from "zod";
import { normalizeStoredStudent, stripStudentClientSoftDeleteFields } from "./studentUtils.js";

const studentCoreSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    contactId: z
      .union([z.string(), z.number()])
      .nullish()
      .transform((v) => (v === null ? undefined : v)),
    fatherContactId: z
      .union([z.string(), z.number()])
      .nullish()
      .transform((v) => (v === null ? undefined : v)),
    motherContactId: z
      .union([z.string(), z.number()])
      .nullish()
      .transform((v) => (v === null ? undefined : v)),
    guardianContactId: z
      .union([z.string(), z.number()])
      .nullish()
      .transform((v) => (v === null ? undefined : v)),
    studentId: z.string().optional(),
    grNumber: z.string().optional(),
    status: z.string().optional(),
    enrollmentDate: z.string().optional(),
    notes: z.string().optional(),
    name: z.string().optional(),
    gender: z.string().optional(),
    dob: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    city: z.string().optional(),
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    guardianName: z.string().optional(),
    // Custom Setup fields: stripped unknown soft-delete keys in normalize; extras allowed via catchall.
  })
  .catchall(z.unknown());

/** Write/read student row schema — strips client soft-delete metadata on parse. */
export const studentRecordSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    return stripStudentClientSoftDeleteFields({ ...(raw as Record<string, unknown>) });
  },
  studentCoreSchema.transform((record) => normalizeStoredStudent(record)),
);

export const studentListSchema = z
  .array(studentCoreSchema)
  .transform((list) => list.map((record) => normalizeStoredStudent(record)));

export type StudentRecord = z.infer<typeof studentCoreSchema>;

/** Tenant-scoped object key for the student ID card template. */
export const STUDENT_CARD_TEMPLATE_OBJECT_KEY = "mms_student_card_template";

/** Students module manifest — SSOT for tiers, permissions, Work, soft-delete, export. */
export const STUDENTS_MODULE_MANIFEST = {
  moduleId: "students",
  entityType: "Student",
  collectionKey: "students",
  /** Legacy remap / backup key — typed field-config lives on `student_field_configs`. */
  settingsObjectKey: "students_settings",
  configObjectKey: "student_field_config",
  preferencesObjectKey: "student_module_preferences",
  columnPreferencesObjectKey: "student_user_column_preferences",
  restBasePath: "/api/students",
  analyticsCategory: "students",
  tiers: ["work", "reports", "setup"] as const,
  permissions: {
    read: "students.read",
    write: "students.write",
    delete: "students.delete",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    export: "students.read",
    reports: "students.read",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["table", "cards"] as const,
    bulkActions: ["whatsapp", "sms", "email", "export", "delete", "status"] as const,
  },
  setupSubTabs: ["preferences", "card_template"] as const,
  defaultExportFilename: "students.csv",
  searchableFieldKeys: [
    "name",
    "grNumber",
    "studentId",
    "cnic",
    "fatherName",
    "guardianName",
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
  /** Default Work directory page size when using server pagination. */
  defaultPageSize: 50,
  maxPageSize: 100,
} as const;
