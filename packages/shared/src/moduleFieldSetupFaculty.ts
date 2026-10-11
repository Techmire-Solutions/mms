import type { TabDefinition, FieldDefinition } from "./contactTypes.js";

// ─── Default Faculty Field Setup Constants ────────────────────────────────────

/** Form tabs Setup cannot disable: Contacts, Employment, Employ Designation. */
export const FACULTY_LOCKED_ENABLED_TABS = ["basic", "employment", "designation"] as const;

/** True when `tabKey` is a locked always-on Faculty form tab. */
export function isFacultyLockedEnabledTab(tabKey: string): boolean {
  const key = tabKey.toLowerCase();
  return FACULTY_LOCKED_ENABLED_TABS.some((locked) => locked === key);
}

export const FACULTY_TAB_REGISTRY: TabDefinition[] = [
  {
    key: "basic",
    label: "Contacts",
    labelKey: "faculty.form.tab.contact",
    enabled: true,
    order: 0,
    isSystem: true,
  },
  {
    key: "employment",
    label: "Employment",
    labelKey: "faculty.form.tab.employment",
    enabled: true,
    order: 1,
    isSystem: true,
  },
  {
    key: "designation",
    label: "Designation",
    labelKey: "faculty.form.tab.designation",
    enabled: true,
    order: 2,
    isSystem: true,
  },
  // Retired person-level hierarchy UI — kept for Setup migration overlays only.
  {
    key: "hierarchy",
    label: "Hierarchy",
    labelKey: "faculty.form.tab.hierarchy",
    enabled: false,
    order: 3,
    isSystem: true,
  },
];

const FACULTY_SEED_FORM_TAB_KEYS = new Set(
  FACULTY_TAB_REGISTRY.map((tab) => tab.key.toLowerCase()),
);

/** True when `tabKey` is a seeded Faculty form tab (not a tenant custom tab). */
export function isFacultySeedFormTab(tabKey: string): boolean {
  return FACULTY_SEED_FORM_TAB_KEYS.has(tabKey.toLowerCase());
}

/** Seeded Faculty form tab definition when `tabKey` matches the registry. */
export function getFacultySeedFormTab(tabKey: string): TabDefinition | undefined {
  const key = tabKey.toLowerCase();
  return FACULTY_TAB_REGISTRY.find((tab) => tab.key.toLowerCase() === key);
}

export const INITIAL_FACULTY_FIELD_SEED: Record<string, FieldDefinition[]> = {
  basic: [
    {
      key: "contactId",
      label: "Contact",
      labelKey: "faculty.field.contact",
      type: "text",
      enabled: true,
      order: 0,
      required: true,
      description: "Contact from the Contacts module (unique email / user registration).",
      descriptionKey: "faculty.fields.contactIdDesc",
    },
    {
      key: "specialization",
      label: "Specialization",
      labelKey: "faculty.field.specialization",
      type: "select",
      enabled: false,
      order: 1,
      required: false,
      description: "Derived from the linked contact profile (not edited on the faculty form).",
      descriptionKey: "faculty.fields.specializationDesc",
    },
    {
      key: "qualification",
      label: "Qualification",
      labelKey: "faculty.field.qualification",
      type: "text",
      enabled: false,
      order: 2,
      required: false,
      description: "Derived from the linked contact profile (not edited on the faculty form).",
      descriptionKey: "faculty.fields.qualificationDesc",
    },
    {
      key: "notes",
      label: "Notes",
      labelKey: "faculty.field.notes",
      type: "textarea",
      enabled: true,
      order: 3,
      required: false,
      description: "Internal notes for this faculty record.",
      descriptionKey: "faculty.fields.notesDesc",
    },
  ],
  employment: [
    {
      key: "employeeId",
      label: "Employee Code",
      labelKey: "faculty.field.employeeId",
      type: "text",
      enabled: true,
      order: 0,
      required: true,
      description: "Employee Code from Setup → Employee ID Configuration (prefix, year, sequence).",
      descriptionKey: "faculty.fields.employeeIdDesc",
    },
    {
      key: "status",
      label: "Employment Status",
      labelKey: "faculty.field.status",
      type: "select",
      enabled: true,
      order: 1,
      required: true,
      description: "Employment lifecycle status (Active, On Leave, Inactive, Retired, Terminated).",
      descriptionKey: "faculty.fields.statusDesc",
    },
    {
      key: "employmentStartDate",
      label: "Employment Start Date",
      labelKey: "faculty.field.employmentStartDate",
      type: "date",
      enabled: true,
      order: 2,
      required: true,
      description: "Date the faculty member's employment began.",
      descriptionKey: "faculty.fields.employmentStartDateDesc",
    },
    {
      key: "employmentEndDate",
      label: "Employment End Date",
      labelKey: "faculty.field.employmentEndDate",
      type: "date",
      enabled: true,
      order: 3,
      required: false,
      description: "Optional date the employment ended (retired, terminated, or left).",
      descriptionKey: "faculty.fields.employmentEndDateDesc",
    },
  ],
  designation: [
    {
      key: "designationId",
      label: "Designation",
      labelKey: "faculty.field.designation",
      type: "select",
      enabled: true,
      order: 0,
      required: true,
      description: "Department + designation from the faculty designation catalog.",
      descriptionKey: "faculty.fields.designationDesc",
    },
    {
      key: "designationStartDate",
      label: "Designation Start Date",
      labelKey: "faculty.field.designationStartDate",
      type: "date",
      enabled: true,
      order: 1,
      required: true,
      description: "Date this employ-designation tenure began (defaults to today).",
      descriptionKey: "faculty.fields.designationStartDateDesc",
    },
    {
      key: "designationEndDate",
      label: "Designation End Date",
      labelKey: "faculty.field.designationEndDate",
      type: "date",
      enabled: true,
      order: 2,
      required: false,
      description: "Optional date this employ-designation tenure ends.",
      descriptionKey: "faculty.fields.designationEndDateDesc",
    },
    {
      key: "employDesignationStatus",
      label: "Employ Designation Status",
      labelKey: "faculty.field.employDesignationStatus",
      type: "select",
      enabled: true,
      order: 3,
      required: true,
      description: "Active or Inactive for this employment's designation tenure.",
      descriptionKey: "faculty.fields.employDesignationStatusDesc",
    },
  ],
  hierarchy: [
    {
      key: "hierarchyRank",
      label: "Hierarchy Rank",
      labelKey: "faculty.field.hierarchyRank",
      type: "number",
      enabled: false,
      order: 0,
      required: false,
      description: "Legacy seniority rank (retired from Add Faculty UI).",
      descriptionKey: "faculty.fields.hierarchyRankDesc",
    },
    {
      key: "reportingFacultyId",
      label: "Reporting Supervisor",
      labelKey: "faculty.field.reportingSupervisor",
      type: "select",
      enabled: false,
      order: 1,
      required: false,
      description: "Legacy person-level supervisor (retired from Add Faculty UI).",
      descriptionKey: "faculty.fields.reportingSupervisorDesc",
    },
  ],
};

const FACULTY_SEED_FIELDS_BY_KEY = new Map<string, FieldDefinition>();
for (const tabFields of Object.values(INITIAL_FACULTY_FIELD_SEED)) {
  for (const field of tabFields) {
    if (!FACULTY_SEED_FIELDS_BY_KEY.has(field.key)) {
      FACULTY_SEED_FIELDS_BY_KEY.set(field.key, field);
    }
  }
}

/** Seeded faculty form field by key (across all seed tabs), or `undefined`. */
export function findFacultySeedField(fieldKey: string): FieldDefinition | undefined {
  return FACULTY_SEED_FIELDS_BY_KEY.get(fieldKey);
}
