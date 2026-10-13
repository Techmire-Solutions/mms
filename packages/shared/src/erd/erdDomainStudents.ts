import type { ErdDomain } from "./erdCatalogTypes.js";

/** Student rows linked to contacts (Drizzle `students.ts`). */
export const ERD_DOMAIN_STUDENTS: ErdDomain = {
  id: "students",
  labelKey: "nav.students",
  tables: [
    {
      name: "students",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "fk" },
        { name: "father_contact_id", type: "text", kind: "fk" },
        { name: "mother_contact_id", type: "text", kind: "fk" },
        { name: "guardian_contact_id", type: "text", kind: "fk" },
        { name: "gr_number", type: "varchar(100)", kind: "column" },
      ],
    },
    {
      name: "student_enrolled_sessions",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "student_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "session_id", type: "varchar(100)", kind: "column" },
      ],
    },
    {
      name: "contacts",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(300)", kind: "column" },
      ],
    },
    {
      name: "student_lookups",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "kind", type: "text", kind: "column" },
        { name: "label", type: "text", kind: "column" },
      ],
    },
    {
      name: "student_field_configs",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "config", type: "jsonb", kind: "column" },
      ],
    },
    {
      name: "student_module_preferences",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "preferences", type: "jsonb", kind: "column" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "students",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "1:1",
      onDelete: "set null",
    },
    {
      fromTable: "students",
      fromColumn: "father_contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "set null",
    },
    {
      fromTable: "students",
      fromColumn: "mother_contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "set null",
    },
    {
      fromTable: "students",
      fromColumn: "guardian_contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "set null",
    },
    {
      fromTable: "student_enrolled_sessions",
      fromColumn: "student_id",
      toTable: "students",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
  ],
};
