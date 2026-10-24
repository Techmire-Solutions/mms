import type { TabDefinition, FieldDefinition } from "../contacts/contactTypes.js";

// ─── Default Finance Field Setup Constants ─────────────────────────────────────

export const FINANCE_TAB_REGISTRY: TabDefinition[] = [
  { key: "basic", label: "Basic Info", enabled: true, order: 0, isSystem: true },
];

export const INITIAL_FINANCE_FIELD_SEED: Record<string, FieldDefinition[]> = {
  basic: [
    {
      key: "studentId",
      label: "Student ID",
      type: "text",
      enabled: true,
      order: 0,
      required: true,
    },
    { key: "amount", label: "Amount", type: "number", enabled: true, order: 1, required: true },
    { key: "dueDate", label: "Due Date", type: "date", enabled: true, order: 2, required: true },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["unpaid", "paid", "partially_paid", "cancelled"],
      enabled: true,
      order: 3,
      required: true,
    },
  ],
};

// ─── Default Hasanat Field Setup Constants ─────────────────────────────────────

export const HASANAT_TAB_REGISTRY: TabDefinition[] = [
  { key: "basic", label: "Basic Info", enabled: true, order: 0, isSystem: true },
];

export const INITIAL_HASANAT_FIELD_SEED: Record<string, FieldDefinition[]> = {
  basic: [
    {
      key: "denominationId",
      label: "Denomination",
      type: "text",
      enabled: true,
      order: 0,
      required: true,
    },
    {
      key: "recipientType",
      label: "Recipient Type",
      type: "select",
      options: ["student", "faculty"],
      enabled: true,
      order: 1,
      required: true,
    },
    {
      key: "recipientName",
      label: "Recipient Name",
      type: "text",
      enabled: true,
      order: 2,
      required: true,
    },
    {
      key: "recipientClass",
      label: "Class / Department",
      type: "text",
      enabled: true,
      order: 3,
      required: false,
    },
    { key: "quantity", label: "Quantity", type: "number", enabled: true, order: 4, required: true },
    {
      key: "issuedDate",
      label: "Issued Date",
      type: "date",
      enabled: true,
      order: 5,
      required: true,
    },
    {
      key: "reason",
      label: "Reason / Achievement",
      type: "textarea",
      enabled: true,
      order: 6,
      required: true,
    },
    { key: "issuedBy", label: "Issued By", type: "text", enabled: true, order: 7, required: false },
  ],
};

// ─── Default Accounting Field Setup Constants ──────────────────────────────────

export const ACCOUNTING_TAB_REGISTRY: TabDefinition[] = [
  { key: "basic", label: "Basic Setup", enabled: true, order: 0, isSystem: true },
];

export const INITIAL_ACCOUNTING_FIELD_SEED: Record<string, FieldDefinition[]> = {
  basic: [
    { key: "code", label: "Account Code", type: "text", enabled: true, order: 0, required: true },
    {
      key: "type",
      label: "Type",
      type: "select",
      options: ["asset", "liability", "equity", "revenue", "expense"],
      enabled: true,
      order: 1,
      required: true,
    },
    { key: "name", label: "Account Name", type: "text", enabled: true, order: 2, required: true },
    { key: "subtype", label: "Sub-type", type: "text", enabled: true, order: 3, required: false },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      enabled: true,
      order: 4,
      required: false,
    },
  ],
};
