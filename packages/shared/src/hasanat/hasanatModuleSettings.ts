import type { TabDefinition } from "../contacts/contactTypes.js";
import type { ModuleFieldDef } from "../settings/moduleFieldSchema.js";
import { INITIAL_HASANAT_FIELD_SEED } from "../settings/moduleFieldSetupFinance.js";

// ─── Hasanat Module Settings ──────────────────────────────────────────────────

export interface HasanatSettings {
  pointsPerUnit: number;
  autoApprovePayouts: boolean;
  defaultViewLayout?: string;
  fields?: Record<string, unknown>;
  customFields?: [];
  fieldOrder?: string[];
  formTabs?: TabDefinition[];
  enabledTabs?: string[];
  requiredTabs?: string[];
}

export const DEFAULT_HASANAT_SETTINGS: HasanatSettings = {
  pointsPerUnit: 10,
  autoApprovePayouts: false,
  defaultViewLayout: "list",
  fields: {
    basic: INITIAL_HASANAT_FIELD_SEED.basic.map((f) => ({ ...f })),
  },
  fieldOrder: [
    "denominationId",
    "recipientType",
    "recipientName",
    "recipientClass",
    "quantity",
    "issuedDate",
    "reason",
    "issuedBy",
  ],
};

export const DEFAULT_HASANAT_FIELD_DEFS: ModuleFieldDef[] = [
  { id: "denominationId", label: "Denomination", required: true },
  { id: "recipientType", label: "Recipient Type", required: true },
  { id: "recipientName", label: "Recipient", required: true },
  { id: "recipientClass", label: "Class / Department" },
  { id: "quantity", label: "Quantity", required: true },
  { id: "issuedDate", label: "Issued Date", required: true },
  { id: "reason", label: "Reason / Achievement", required: true },
  { id: "issuedBy", label: "Issued By" },
];
