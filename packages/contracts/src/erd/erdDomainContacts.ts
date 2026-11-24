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
