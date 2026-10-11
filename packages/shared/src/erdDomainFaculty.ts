import type { ErdDomain } from "./erdCatalogTypes.js";

/** Staff rows linked to contacts via faculty_assignments. */
export const ERD_DOMAIN_FACULTY: ErdDomain = {
  id: "faculty",
  labelKey: "nav.faculty",
  tables: [
    {
      name: "faculty",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "fk" },
        { name: "employment_id", type: "text", kind: "fk" },
        { name: "user_id", type: "text", kind: "fk" },
        { name: "employee_id", type: "varchar(100)", kind: "column" },
        { name: "specialization", type: "varchar(150)", kind: "column" },
        { name: "qualification", type: "varchar(255)", kind: "column" },
        { name: "employment_start_date", type: "date", kind: "column" },
        { name: "status", type: "varchar(50)", kind: "column" },
      ],
    },
    {
      name: "faculty_assignments",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "faculty_id", type: "text", kind: "fk" },
        { name: "department_id", type: "text", kind: "fk" },
        { name: "designation_id", type: "text", kind: "fk" },
        { name: "is_primary", type: "boolean", kind: "column" },
        { name: "status", type: "varchar(20)", kind: "column" },
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
      name: "tenant_users",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "fk" },
      ],
    },
    {
      name: "faculty_lookups",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "kind", type: "text", kind: "column" },
        { name: "label", type: "text", kind: "column" },
      ],
    },
    {
      name: "faculty_field_configs",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "config", type: "jsonb", kind: "column" },
      ],
    },
    {
      name: "faculty_module_preferences",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "preferences", type: "jsonb", kind: "column" },
      ],
    },
    {
      name: "faculty_setup_config",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "prefix", type: "varchar(20)", kind: "column" },
        { name: "current_sequence", type: "integer", kind: "column" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "faculty",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "1:1",
      onDelete: "set null",
    },
    {
      fromTable: "faculty",
      fromColumn: "user_id",
      toTable: "tenant_users",
      toColumn: "id",
      cardinality: "1:1",
      onDelete: "set null",
    },
    {
      fromTable: "faculty_assignments",
      fromColumn: "faculty_id",
      toTable: "faculty",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
  ],
};
