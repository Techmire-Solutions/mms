import type { ErdDomain } from "./erdCatalogTypes.js";

/** SMS / WhatsApp / email logs (Drizzle `messaging.ts`). */
export const ERD_DOMAIN_MESSAGING: ErdDomain = {
  id: "messaging",
  labelKey: "nav.messaging",
  tables: [
    {
      name: "message_templates",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "label", type: "varchar(255)", kind: "column" },
        { name: "channel", type: "varchar(50)", kind: "column" },
      ],
    },
    {
      name: "message_logs",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "contact_id", type: "varchar(64)", kind: "fk" },
        { name: "channel", type: "varchar(30)", kind: "column" },
        { name: "status", type: "varchar(30)", kind: "column" },
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
      name: "email_integrations",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "provider_id", type: "varchar(40)", kind: "column" },
        { name: "from_address", type: "varchar(255)", kind: "column" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "message_logs",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
    },
  ],
};

/** Stock, sales, and related commerce tables (Drizzle `inventory.ts`). */
export const ERD_DOMAIN_INVENTORY: ErdDomain = {
  id: "inventory",
  labelKey: "platform.erdDomainInventory",
  tables: [
    {
      name: "inventory_items",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "text", kind: "column" },
        { name: "item_type", type: "varchar(30)", kind: "column" },
        { name: "remaining_stock", type: "integer", kind: "column" },
      ],
    },
    {
      name: "inventory_sales",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "item_id", type: "text", kind: "fk" },
        { name: "student_id", type: "text", kind: "fk" },
        { name: "qty", type: "integer", kind: "column" },
      ],
    },
    {
      name: "students",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "gr_number", type: "varchar(100)", kind: "column" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "inventory_sales",
      fromColumn: "item_id",
      toTable: "inventory_items",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "inventory_sales",
      fromColumn: "student_id",
      toTable: "students",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "set null",
    },
  ],
};

/** Charity, orphans, fatwa, and fundraising (Drizzle `charity.ts`). */
export const ERD_DOMAIN_CHARITY: ErdDomain = {
  id: "charity",
  labelKey: "platform.erdDomainCharity",
  tables: [
    {
      name: "fundraising_campaigns",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "campaign_name", type: "text", kind: "column" },
      ],
    },
    {
      name: "fundraising_coupons",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "campaign_id", type: "text", kind: "fk" },
        { name: "price", type: "numeric(15,2)", kind: "column" },
      ],
    },
    {
      name: "orphan_profiles",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "sponsor_contact_id", type: "text", kind: "fk" },
      ],
    },
    {
      name: "fatwa_tickets",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "assigned_mufti_id", type: "text", kind: "fk" },
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
      ],
    },
  ],
  relationships: [
    {
      fromTable: "fundraising_coupons",
      fromColumn: "campaign_id",
      toTable: "fundraising_campaigns",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "orphan_profiles",
      fromColumn: "sponsor_contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "set null",
    },
    {
      fromTable: "fatwa_tickets",
      fromColumn: "assigned_mufti_id",
      toTable: "tenant_users",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "set null",
    },
  ],
};

/** Workshops, scores, and competitions (Drizzle `workshops.ts`). */
export const ERD_DOMAIN_WORKSHOPS: ErdDomain = {
  id: "workshops",
  labelKey: "platform.erdDomainWorkshops",
  tables: [
    {
      name: "workshop_events",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "title", type: "text", kind: "column" },
      ],
    },
    {
      name: "workshop_participants",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "workshop_id", type: "text", kind: "fk" },
        { name: "contact_id", type: "text", kind: "fk" },
      ],
    },
    {
      name: "workshop_scores",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "workshop_id", type: "text", kind: "fk" },
        { name: "participant_id", type: "text", kind: "fk" },
        { name: "score", type: "numeric(15,2)", kind: "column" },
      ],
    },
    {
      name: "competition_events",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "title", type: "text", kind: "column" },
      ],
    },
    {
      name: "competition_participants",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "competition_id", type: "text", kind: "fk" },
        { name: "student_id", type: "text", kind: "fk" },
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
  ],
  relationships: [
    {
      fromTable: "workshop_participants",
      fromColumn: "workshop_id",
      toTable: "workshop_events",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "workshop_participants",
      fromColumn: "contact_id",
      toTable: "contacts",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "workshop_scores",
      fromColumn: "workshop_id",
      toTable: "workshop_events",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "workshop_scores",
      fromColumn: "participant_id",
      toTable: "workshop_participants",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "competition_participants",
      fromColumn: "competition_id",
      toTable: "competition_events",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
  ],
};
