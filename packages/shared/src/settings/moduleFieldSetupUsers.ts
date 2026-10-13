import type { TabDefinition, FieldDefinition } from "../contacts/contactTypes.js";

// ─── Default Users Field Setup Constants ───────────────────────────────────────

export const USERS_TAB_REGISTRY: TabDefinition[] = [
  { key: "basic", label: "Account Info", enabled: true, order: 0, isSystem: true },
  { key: "security", label: "Security & Roles", enabled: true, order: 1, isSystem: true },
];

export const INITIAL_USERS_FIELD_SEED: Record<string, FieldDefinition[]> = {
  basic: [
    { key: "name", label: "Full Name", type: "text", enabled: true, order: 0, required: true },
    {
      key: "email",
      label: "Email Address",
      type: "email",
      enabled: true,
      order: 1,
      required: true,
    },
  ],
  security: [
    {
      key: "roles",
      label: "System Roles",
      type: "multiselect",
      options: ["admin", "teacher", "student", "guardian", "accountant"],
      enabled: true,
      order: 0,
      required: true,
    },
  ],
};
