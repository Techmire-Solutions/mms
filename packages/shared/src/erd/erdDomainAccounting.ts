import type { ErdDomain } from "./erdCatalogTypes.js";

/** Accounting + student billing tables (Drizzle `accounting.ts` / `finance.ts`). */
export const ERD_DOMAIN_ACCOUNTING: ErdDomain = {
  id: "accounting",
  labelKey: "nav.accounting",
  tables: [
    {
      name: "accounting_accounts",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "code", type: "varchar(50)", kind: "unique" },
        { name: "name", type: "varchar(150)", kind: "column" },
        { name: "type", type: "varchar(50)", kind: "column" },
        { name: "deleted_at", type: "timestamptz", kind: "column" },
      ],
    },
    {
      name: "accounting_fiscal_years",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "label", type: "varchar(120)", kind: "column" },
        { name: "start_date", type: "varchar(10)", kind: "column" },
        { name: "end_date", type: "varchar(10)", kind: "column" },
        { name: "status", type: "varchar(20)", kind: "column" },
        { name: "closed_at", type: "timestamptz", kind: "column" },
      ],
    },
    {
      name: "accounting_posting_rules",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "ar_account_id", type: "text", kind: "fk" },
        { name: "cash_account_id", type: "text", kind: "fk" },
        { name: "income_account_id", type: "text", kind: "fk" },
      ],
    },
    {
      name: "accounting_opening_balances",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "fiscal_year_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "account_id", type: "text", kind: "fk" },
        { name: "debit", type: "numeric(14,2)", kind: "column" },
        { name: "credit", type: "numeric(14,2)", kind: "column" },
      ],
    },
    {
      name: "accounting_bank_statements",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "account_id", type: "text", kind: "fk" },
        { name: "period_start", type: "varchar(10)", kind: "column" },
        { name: "period_end", type: "varchar(10)", kind: "column" },
      ],
    },
    {
      name: "accounting_bank_statement_lines",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "statement_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "amount", type: "numeric(14,2)", kind: "column" },
      ],
    },
    {
      name: "accounting_bank_reconciliations",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "statement_line_id", type: "text", kind: "pk" },
        { name: "journal_entry_id", type: "text", kind: "fk" },
        { name: "journal_line_id", type: "text", kind: "fk" },
      ],
    },
    {
      name: "accounting_entries",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "date", type: "varchar(10)", kind: "column" },
        { name: "ref", type: "varchar(100)", kind: "column" },
        { name: "status", type: "varchar(20)", kind: "column" },
        { name: "fiscal_year", type: "varchar(64)", kind: "column" },
        { name: "fiscal_year_id", type: "text", kind: "fk" },
        { name: "source_type", type: "varchar(20)", kind: "column" },
        { name: "source_id", type: "varchar(64)", kind: "column" },
      ],
    },
    {
      name: "accounting_journal_lines",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "entry_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "account_id", type: "text", kind: "fk" },
        { name: "debit", type: "numeric(14,2)", kind: "column" },
        { name: "credit", type: "numeric(14,2)", kind: "column" },
      ],
    },
    {
      name: "accounting_entry_tags",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "entry_id", type: "text", kind: "pk" },
        { name: "tag", type: "varchar(64)", kind: "pk" },
      ],
    },
    {
      name: "accounting_entry_attachments",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "entry_id", type: "text", kind: "pk" },
        { name: "url", type: "text", kind: "pk" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "accounting_entries",
      fromColumn: "fiscal_year_id",
      toTable: "accounting_fiscal_years",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "accounting_journal_lines",
      fromColumn: "entry_id",
      toTable: "accounting_entries",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "accounting_journal_lines",
      fromColumn: "account_id",
      toTable: "accounting_accounts",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "accounting_entry_tags",
      fromColumn: "entry_id",
      toTable: "accounting_entries",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "accounting_entry_attachments",
      fromColumn: "entry_id",
      toTable: "accounting_entries",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "accounting_opening_balances",
      fromColumn: "fiscal_year_id",
      toTable: "accounting_fiscal_years",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "accounting_opening_balances",
      fromColumn: "account_id",
      toTable: "accounting_accounts",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "accounting_bank_statements",
      fromColumn: "account_id",
      toTable: "accounting_accounts",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "accounting_bank_statement_lines",
      fromColumn: "statement_id",
      toTable: "accounting_bank_statements",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "accounting_bank_reconciliations",
      fromColumn: "journal_entry_id",
      toTable: "accounting_entries",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
  ],
};
