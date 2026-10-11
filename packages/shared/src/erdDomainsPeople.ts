import type { ErdDomain } from "./erdCatalogTypes.js";

/** Canonical person directory and child collections (Drizzle `contacts.ts`). */
export const ERD_DOMAIN_CONTACTS: ErdDomain = {
  id: "contacts",
  labelKey: "nav.contacts",
  tables: [
    {
      name: "contacts",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "first_name", type: "varchar(150)", kind: "column" },
        { name: "name", type: "varchar(300)", kind: "column" },
        { name: "cnic", type: "varchar(30)", kind: "unique" },
      ],
    },
    {
      name: "contact_phones",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "number", type: "varchar(50)", kind: "column" },
      ],
    },
    {
      name: "contact_emails",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "address", type: "varchar(255)", kind: "column" },
      ],
    },
    {
      name: "contact_addresses",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "city", type: "varchar(100)", kind: "column" },
        { name: "country", type: "varchar(100)", kind: "column" },
      ],
    },
    {
      name: "contact_tags",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(100)", kind: "column" },
      ],
    },
    {
      name: "contact_socials",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "platform", type: "varchar(50)", kind: "column" },
        { name: "url", type: "text", kind: "column" },
      ],
    },
    {
      name: "contact_educations",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "institution", type: "varchar(255)", kind: "column" },
        { name: "degree", type: "varchar(150)", kind: "column" },
        { name: "year", type: "varchar(50)", kind: "column" },
      ],
    },
    {
      name: "contact_experiences",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "title", type: "varchar(255)", kind: "column" },
        { name: "organization", type: "varchar(255)", kind: "column" },
        { name: "employment_type", type: "varchar(100)", kind: "column" },
      ],
    },
    {
      name: "contact_skills",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(255)", kind: "column" },
        { name: "proficiency", type: "varchar(50)", kind: "column" },
        { name: "category", type: "varchar(100)", kind: "column" },
      ],
    },
    {
      name: "contact_relationships",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "related_contact_id", type: "varchar(64)", kind: "fk" },
        { name: "relationship", type: "varchar(100)", kind: "column" },
      ],
    },
    {
      name: "contact_activities",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "type", type: "varchar(50)", kind: "column" },
        { name: "content", type: "text", kind: "column" },
      ],
    },
    {
      name: "contact_attachments",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(255)", kind: "column" },
        { name: "type", type: "varchar(100)", kind: "column" },
      ],
    },
    {
      name: "contact_bank_details",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "bank_name", type: "varchar(255)", kind: "column" },
        { name: "account_title", type: "varchar(255)", kind: "column" },
        { name: "account_number", type: "varchar(100)", kind: "column" },
      ],
    },
    {
      name: "contact_lookups",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "kind", type: "text", kind: "column" },
        { name: "label", type: "text", kind: "column" },
      ],
    },
    {
      name: "contact_field_configs",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "config", type: "jsonb", kind: "column" },
      ],
    },
    {
      name: "contact_module_preferences",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "preferences", type: "jsonb", kind: "column" },
      ],
    },
    {
      name: "contact_google_sync_credentials",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "user_id", type: "text", kind: "pk" },
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
  ],
  relationships: [
    {
      fromTable: "contact_phones",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "contact_emails",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "contact_addresses",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "contact_tags",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "contact_socials",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "contact_educations",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "contact_experiences",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "contact_skills",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "contact_relationships",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "contact_activities",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "contact_attachments",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "contact_bank_details",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "tenant_users",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "1:1",
    },
  ],
};

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
