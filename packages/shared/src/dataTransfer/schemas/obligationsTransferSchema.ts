/**
 * @file obligationsTransferSchema.ts
 * @description Transfer (CSV) field map for the Obligations module.
 *
 * The field list mirrors the persisted receipt: `obligation_collections` has no title, no status,
 * no due date and no notes. The schema used to advertise all four (with `status` defaulting to
 * `"pending"` and `dueDate` always empty), which made the exported template describe a pledge with
 * a lifecycle the module does not have — the vocabulary came from Finance invoices, not from here.
 *
 * Name resolution for the donor/type/representative columns belongs to the export/import job
 * runners (deferred: the module registers none yet), so the cells carry ids for now.
 */
import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface ObligationTransferEntity {
  receiptNo: string;
  receivedDate: string;
  donorName?: string;
  representative: string;
  amount: string | number;
  currency?: string;
  paymentMode?: string;
  reference?: string;
}

export const obligationsTransferSchema: ModuleTransferSchema<ObligationTransferEntity> =
  createModuleTransferSchema<ObligationTransferEntity>({
    moduleId: "obligations",
    entityNounPlural: "obligations",
    defaultFilename: "obligations.csv",
    fields: [
      {
        key: "receiptNo",
        label: "Receipt No",
        aliases: ["receipt", "receipt_number", "voucher"],
        required: true,
        sample: "OB-2026-0001",
        extract: (o) => o.receiptNo || "",
      },
      {
        key: "receivedDate",
        label: "Received Date",
        aliases: ["received_date", "date", "paid_date"],
        required: true,
        sample: "2026-10-24",
        extract: (o) => o.receivedDate || "",
      },
      {
        key: "donorName",
        label: "Donor",
        aliases: ["donor", "sender", "payer"],
        sample: "Haji Ghulam",
        extract: (o) => o.donorName || "",
      },
      {
        key: "representative",
        label: "Representative",
        aliases: ["rep", "wakala", "agent"],
        required: true,
        sample: "Sayyid Ja'far",
        extract: (o) => o.representative || "",
      },
      {
        key: "amount",
        label: "Amount Received",
        aliases: ["amount", "total", "received"],
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
        key: "paymentMode",
        label: "Payment Mode",
        aliases: ["mode", "method"],
        sample: "Cash",
        extract: (o) => o.paymentMode || "Cash",
      },
      {
        key: "reference",
        label: "Reference",
        aliases: ["ref", "reference_id"],
        sample: "Bank slip 88213",
        extract: (o) => o.reference || "",
      },
    ],
  });

registerModuleTransferSchema(obligationsTransferSchema);
