import type { Faculty } from "@mms/shared";
import { FACULTY_DIRECTORY_COLUMN_SURFACES, facultyFieldLabelKey } from "@mms/shared";
import type { EntityDescriptor, FieldDefinition, FieldValueType } from "@/types/entityRegistry";
import { createEntityDescriptor } from "../entityDescriptorFactory";

const SURFACE_FIELD_TYPE: Record<string, FieldValueType> = {
  name: "text",
  employeeId: "text",
  designation: "text",
  department: "text",
  reportingFacultyName: "text",
  specialization: "text",
  qualification: "text",
  joinDate: "text",
  status: "status",
  updatedAt: "text",
};

/**
 * Entity descriptor fields derived from {@link FACULTY_DIRECTORY_COLUMN_SURFACES}
 * plus contact phone / subordinate count / gender (filter chips).
 */
const directoryFields: FieldDefinition<Faculty>[] = FACULTY_DIRECTORY_COLUMN_SURFACES.map(
  (surface, index) => ({
    key: surface.key,
    label: surface.label,
    labelKey: surface.labelKey ?? facultyFieldLabelKey(surface.key),
    type: SURFACE_FIELD_TYPE[surface.key] ?? "text",
    sortable: surface.sortable,
    filterable:
      surface.key === "status" ||
      surface.key === "specialization" ||
      surface.key === "department" ||
      surface.key === "designation" ||
      surface.key === "reportingFacultyName",
    defaultVisibleInTable: surface.work,
    tableOrder: (index + 1) * 10,
    fixed: surface.fixed || undefined,
    cardSlot: surface.fixed ? "primary" : surface.key === "status" ? "badge" : "meta",
    drawerSection: surface.key === "name" ? "identity" : "employment",
    drawerOrder: (index + 1) * 10,
  }),
);

export const facultyEntityDescriptor: EntityDescriptor<Faculty> = createEntityDescriptor<Faculty>({
  entityType: "faculty",
  singularLabel: "Faculty Member",
  pluralLabel: "Faculty",
  idField: "id",
  titleField: "name",
  fields: [
    ...directoryFields,
    {
      key: "gender",
      label: "Gender",
      labelKey: "faculty.field.gender",
      type: "badge",
      filterable: true,
      sortable: false,
      defaultVisibleInTable: false,
      tableOrder: 195,
      cardSlot: "meta",
      drawerSection: "contact",
      drawerOrder: 195,
    },
    {
      key: "phone",
      label: "Phone",
      labelKey: "faculty.field.phone",
      type: "phone",
      sortable: false,
      defaultVisibleInTable: false,
      tableOrder: 200,
      cardSlot: "meta",
      drawerSection: "contact",
      drawerOrder: 200,
    },
    {
      key: "subordinateCount",
      label: "Subordinates",
      labelKey: "faculty.columns.subordinates",
      type: "number",
      sortable: false,
      defaultVisibleInTable: false,
      tableOrder: 210,
      cardSlot: "meta",
      drawerSection: "employment",
      drawerOrder: 210,
    },
  ],
});
