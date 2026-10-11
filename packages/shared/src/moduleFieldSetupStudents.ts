import type { TabDefinition, FieldDefinition } from "./contactTypes.js";

// ─── Default Students Field Setup Constants ───────────────────────────────────

export const DEFAULT_STUDENT_ENABLED_TABS = ["registration"];
export const DEFAULT_STUDENT_REQUIRED_TABS: string[] = [];

/** Form tabs Setup cannot disable; the form always treats them as on. */
export const STUDENT_LOCKED_ENABLED_TABS = ["basic"] as const;

export const STUDENT_TAB_REGISTRY: TabDefinition[] = [
  {
    key: "basic",
    label: "Identity",
    labelKey: "students.form.tab.basic",
    enabled: true,
    order: 0,
    isSystem: true,
  },
  {
    key: "registration",
    label: "Registration",
    labelKey: "students.form.tab.registration",
    enabled: true,
    order: 1,
    isSystem: true,
  },
];

const STUDENT_SEED_FORM_TAB_KEYS = new Set(
  STUDENT_TAB_REGISTRY.map((tab) => tab.key.toLowerCase()),
);

/** True when `tabKey` is a locked always-on Students form tab. */
export function isStudentLockedEnabledTab(tabKey: string): boolean {
  const key = tabKey.toLowerCase();
  return STUDENT_LOCKED_ENABLED_TABS.some((locked) => locked === key);
}

/** True when `tabKey` is a seeded Students form tab (not a tenant custom tab). */
export function isStudentSeedFormTab(tabKey: string): boolean {
  return STUDENT_SEED_FORM_TAB_KEYS.has(tabKey.toLowerCase());
}

/** Seeded Students form tab definition when `tabKey` matches the registry. */
export function getStudentSeedFormTab(tabKey: string): TabDefinition | undefined {
  const key = tabKey.toLowerCase();
  return STUDENT_TAB_REGISTRY.find((tab) => tab.key.toLowerCase() === key);
}
export const INITIAL_STUDENT_FIELD_SEED: Record<string, FieldDefinition[]> = {
  basic: [
    {
      key: "contactId",
      label: "Student Contact",
      labelKey: "students.form.contactLabel",
      type: "text",
      enabled: true,
      order: 0,
      required: true,
      description: "Contact picker — links the canonical person record for this student.",
      descriptionKey: "students.fields.contactIdDesc",
    },
    {
      key: "gender",
      label: "Gender",
      labelKey: "students.gender",
      type: "select",
      options: ["Male", "Female"],
      enabled: true,
      order: 1,
      required: true,
      description: "Must be defined (not empty) on the linked contact profile.",
      descriptionKey: "students.fields.genderDesc",
    },
    {
      key: "dob",
      label: "Date of Birth",
      labelKey: "students.form.fieldDob",
      type: "date",
      enabled: true,
      order: 2,
      required: true,
      description: "Must be provided (not empty) on the linked contact profile.",
      descriptionKey: "students.fields.dobDesc",
    },
    {
      key: "contactRelationships",
      label: "Relationships",
      labelKey: "students.fields.contactRelationships",
      type: "text",
      enabled: true,
      order: 3,
      required: false,
      description:
        "Shown from the linked contact’s Relationships in Contacts (Parent/Child, Husband/Wife, Guardian/Dependent).",
      descriptionKey: "students.fields.contactRelationshipsDesc",
    },
  ],
  registration: [
    {
      key: "grNumber",
      label: "GR Number",
      labelKey: "students.form.grNumber",
      type: "text",
      enabled: true,
      order: 0,
      required: true,
      description: "General register number — auto-assigned from Setup Preferences when enabled.",
      descriptionKey: "students.fields.grNumberDesc",
    },
    {
      key: "status",
      label: "Status",
      labelKey: "students.form.status",
      type: "select",
      enabled: true,
      order: 1,
      required: true,
      description: "Enrollment status for this student (options from student status preferences).",
      descriptionKey: "students.fields.statusDesc",
    },
    {
      key: "registeredDate",
      label: "Registration Date",
      labelKey: "students.form.registeredDate",
      type: "date",
      enabled: true,
      order: 2,
      required: true,
      description:
        "Timestamp set when the student profile is registered; displayed read-only on the form.",
      descriptionKey: "students.fields.registeredDateDesc",
    },
    {
      key: "notes",
      label: "Notes",
      labelKey: "students.form.notesLabel",
      type: "textarea",
      enabled: true,
      order: 3,
      required: false,
      description: "Internal notes for this student record.",
      descriptionKey: "students.fields.notesDesc",
    },
  ],
};

/** Registration tab system field keys from Setup seed (FormModal + Zod tab mapping). */
export const STUDENT_REGISTRATION_SEED_FIELD_KEYS = new Set(
  (INITIAL_STUDENT_FIELD_SEED.registration ?? []).map((field) => field.key),
);

/**
 * Detail drawer fields shown in hero / notes chrome — skip from the attributes list.
 * Pair with {@link OBSOLETE_STUDENT_GUARDIAN_FIELD_KEYS} when filtering detail rows.
 */
export const STUDENT_DETAIL_HERO_FIELD_KEYS = new Set(["contactId", "grNumber", "status", "notes"]);

export {
  DEFAULT_STUDENT_COLUMN_REGISTRY,
  STUDENT_CARD_FACE_COLUMN_IDS,
  STUDENT_COLUMN_FIELD_MAPPING,
} from "./studentDirectoryColumns.js";

/** Face chrome on Contacts Work cards — excluded from the metadata tile grid. */
export const CONTACT_CARD_FACE_COLUMN_IDS = new Set(["name", "phone", "email", "gender", "isSyed"]);
