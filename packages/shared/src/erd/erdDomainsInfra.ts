import type { ErdDomain } from "./erdCatalogTypes.js";

/** Task management (Drizzle tasksTables + taskSettingsTables). */
export const ERD_DOMAIN_TASKS: ErdDomain = {
  id: "tasks",
  labelKey: "nav.tasks",
  tables: [
    {
      name: "tasks",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "title", type: "varchar(255)", kind: "column" },
        { name: "status", type: "varchar(32)", kind: "column" },
        { name: "parent_task_id", type: "text", kind: "fk" },
      ],
    },
    {
      name: "task_assignees",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "task_id", type: "text", kind: "fk" },
        { name: "user_id", type: "text", kind: "fk" },
      ],
    },
    {
      name: "task_module_preferences",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "preferences", type: "jsonb", kind: "column" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "task_assignees",
      fromColumn: "task_id",
      toTable: "tasks",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
  ],
};

/** Users module setup tables (Drizzle `users.ts`). */
export const ERD_DOMAIN_USERS: ErdDomain = {
  id: "users",
  labelKey: "nav.users",
  tables: [
    {
      name: "user_field_configs",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "config", type: "jsonb", kind: "column" },
      ],
    },
    {
      name: "user_module_preferences",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "preferences", type: "jsonb", kind: "column" },
      ],
    },
  ],
  relationships: [],
};

/** Dashboard preferences and widgets (Drizzle `dashboard.ts`). */
export const ERD_DOMAIN_DASHBOARD: ErdDomain = {
  id: "dashboard",
  labelKey: "nav.dashboard",
  tables: [
    {
      name: "dashboard_preferences",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "preferences", type: "jsonb", kind: "column" },
      ],
    },
    {
      name: "dashboard_widgets",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "title", type: "varchar(255)", kind: "column" },
        { name: "category", type: "varchar(64)", kind: "column" },
      ],
    },
  ],
  relationships: [],
};

/** CDC outbox events (Drizzle `outboxEvents.ts`). */
export const ERD_DOMAIN_OUTBOX: ErdDomain = {
  id: "outbox",
  labelKey: "platform.erdDomainOutbox",
  tables: [
    {
      name: "outbox_events",
      columns: [
        { name: "id", type: "bigint", kind: "pk" },
        { name: "workspace_subdomain", type: "text", kind: "fk" },
        { name: "event_type", type: "varchar(64)", kind: "column" },
        { name: "entity_type", type: "varchar(64)", kind: "column" },
        { name: "entity_id", type: "varchar(128)", kind: "column" },
      ],
    },
  ],
  relationships: [],
};
