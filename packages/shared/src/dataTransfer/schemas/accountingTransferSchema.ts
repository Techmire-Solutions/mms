/**
 * @file accountingTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Accounting.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface AccountingTransferEntity {
  code: string;
  name: string;
  type: string;
  category?: string;
  currency?: string;
  balance?: string | number;
  status?: string;
  description?: string;
}

export const accountingTransferSchema: ModuleTransferSchema<AccountingTransferEntity> =
  createModuleTransferSchema<AccountingTransferEntity>({
    moduleId: "accounting",
    entityNounPlural: "accounts",
    defaultFilename: "chart-of-accounts.csv",
    fields: [
      {
        key: "code",
        label: "Account Code",
        aliases: ["account_code", "Account Number", "Number"],
        required: true,
        sample: "1010",
        extract: (a) => a.code || "",
      },
      {
        key: "name",
        label: "Account Name",
        aliases: ["account_name", "Title", "Name"],
        required: true,
        sample: "Main Operating Cash",
        extract: (a) => a.name || "",
      },
      {
        key: "type",
        label: "Account Type",
        aliases: ["account_type", "Class"],
        required: true,
        sample: "asset",
        extract: (a) => a.type || "asset",
      },
      {
        key: "category",
        label: "Category",
        aliases: ["sub_type", "Subcategory"],
        sample: "Current Assets",
        extract: (a) => a.category || "",
      },
      {
        key: "currency",
        label: "Currency",
        aliases: ["curr"],
        sample: "PKR",
        extract: (a) => a.currency || "PKR",
      },
      {
        key: "balance",
        label: "Current Balance",
        aliases: ["current_balance", "Balance"],
        sample: "250000.00",
        extract: (a) => (a.balance != null ? String(a.balance) : "0.00"),
      },
      {
        key: "status",
        label: "Status",
        aliases: ["Account Status"],
        sample: "active",
        extract: (a) => a.status || "active",
      },
      {
        key: "description",
        label: "Description",
        aliases: ["notes", "Remarks"],
        sample: "Primary treasury cash account",
        extract: (a) => a.description || "",
      },
    ],
  });

registerModuleTransferSchema(accountingTransferSchema);
