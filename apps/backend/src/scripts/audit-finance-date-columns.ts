import { loadBackendEnv } from "../config/loadEnv.js";
import { runDateShapeAudit } from "./dateShapeAudit.js";
import type { DateColumn } from "./dateShapeAudit.js";

loadBackendEnv();

/**
 * Read-only audit for Phase 7, finance half: the varchar date columns 0172/0182 left behind in
 * accounting, finance, hasanat, obligations and contact profiles. Run before authoring the
 * expand migration, and again before its contract step:
 *
 *   pnpm --filter mms-backend audit:finance-date-columns
 *
 * Stricter than the academic audit because these are money-dated rows: an impossible day, a
 * DD/MM/YYYY value (day/month order cannot be inferred), a year outside 1900–2100, or a zoned
 * date-time whose UTC prefix may be the wrong local day all block, not just unparseable text.
 * `finance_invoices.billing_period` is a `YYYY-MM` key in a unique index and is out of scope.
 */
export const PHASE7_FINANCE_DATE_COLUMNS: ReadonlyArray<DateColumn> = [
  ["accounting_fiscal_years", "start_date"],
  ["accounting_fiscal_years", "end_date"],
  ["accounting_posting_periods", "start_date"],
  ["accounting_posting_periods", "end_date"],
  ["accounting_entries", "date"],
  ["accounting_bank_statements", "period_start"],
  ["accounting_bank_statements", "period_end"],
  ["accounting_bank_statement_lines", "date"],
  ["finance_invoices", "due_date"],
  ["finance_invoices", "paid_date"],
  ["finance_payments", "date"],
  ["hasanat_batches", "added_date"],
  ["hasanat_distributions", "issued_date"],
  ["hasanat_redemptions", "date"],
  ["obligation_collections", "received_date"],
  ["contact_experiences", "start_date"],
  ["contact_experiences", "end_date"],
  ["contact_activities", "date"],
  ["contact_attachments", "date"],
];

await runDateShapeAudit({
  label: "audit:finance-date-columns",
  columns: PHASE7_FINANCE_DATE_COLUMNS,
  blockOn: ["impossible", "outOfRange", "dmy", "zoned"],
});
