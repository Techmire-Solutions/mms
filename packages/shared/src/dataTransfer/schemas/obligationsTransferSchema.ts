/**
 * @file obligationsTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Obligations.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface ObligationTransferEntity {
  title: string;
  representative: string;
  donorName?: string;
  amount: string | number;
  currency?: string;
  status?: string;
  dueDate?: string;
  notes?: string;
}

export const obligationsTransferSchema: ModuleTransferSchema<ObligationTransferEntity> =
  createModuleTransferSchema<ObligationTransferEntity>({
    moduleId: "obligations",
    entityNounPlural: "obligations",
    defaultFilename: "obligations.csv",
    fields: [
      {
        key: "title",
        label: "Obligation Title",
        aliases: ["obligation", "Title", "Purpose"],
        required: true,
        sample: "Annual Orphan Sponsorship Dues",
        extract: (o) => o.title || "",
      },
      {
        key: "representative",
        label: "Representative / Wakala",
        aliases: ["rep", "Wakala", "Agent"],
        required: true,
        sample: "Sayyid Ja'far",
        extract: (o) => o.representative || "",
      },
      {
        key: "donorName",
        label: "Donor / Obligor",
        aliases: ["donor", "Obligor", "Payer"],
        sample: "Haji Ghulam",
        extract: (o) => o.donorName || "",
      },
      {
        key: "amount",
        label: "Amount Due",
        aliases: ["amount", "Total", "Due"],
        required: true,
        sample: "50000.00",
        extract: (o) => (o.amount != null ? String(o.amount) : "0.00"),
      },
      {
        key: "currency",
        label: "Currency",
        aliases: ["curr"],
        sample: "PKR",
        extract: (o) => o.currency || "PKR",
      },
      {
        key: "status",
        label: "Status",
        aliases: ["obligation_status", "State"],
        sample: "pending",
        extract: (o) => o.status || "pending",
      },
      {
        key: "dueDate",
        label: "Due Date",
        aliases: ["due_date", "Target Date"],
        sample: "2024-10-31",
        extract: (o) => o.dueDate || "",
      },
      {
        key: "notes",
        label: "Notes / Remarks",
        aliases: ["remarks", "Comments"],
        sample: "Designated for Najaf student welfare fund",
        extract: (o) => o.notes || "",
      },
    ],
  });

registerModuleTransferSchema(obligationsTransferSchema);
