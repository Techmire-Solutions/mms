import { z } from "zod";
import type { AppTranslationKey } from "./appTranslations.js";

/**
 * A journal entry template ("tag"): its name is written to `JournalEntry.tags`,
 * and its default heads pre-fill the debit and credit lines of a new voucher.
 * An empty head means "pick it on the voucher".
 */
export const journalTemplateSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(60),
    debitAccountId: z.string().default(""),
    creditAccountId: z.string().default(""),
  })
  .strict();

export const JOURNAL_TEMPLATES_MAX = 50;

export const journalTemplatesSchema = z.array(journalTemplateSchema).max(JOURNAL_TEMPLATES_MAX);

export type JournalTemplate = z.infer<typeof journalTemplateSchema>;

/** Keeps only well-formed templates with unique ids and names (case-insensitive); never throws. */
export function normalizeJournalTemplates(raw: unknown): JournalTemplate[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const templates: JournalTemplate[] = [];
  for (const candidate of raw) {
    const parsed = journalTemplateSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const nameKey = parsed.data.name.toLowerCase();
    if (seenIds.has(parsed.data.id) || seenNames.has(nameKey)) continue;
    seenIds.add(parsed.data.id);
    seenNames.add(nameKey);
    templates.push(parsed.data);
    if (templates.length === JOURNAL_TEMPLATES_MAX) break;
  }
  return templates;
}

export interface JournalTemplateSeed {
  id: string;
  nameKey: AppTranslationKey;
  /** Account codes from `DEFAULT_CHART_OF_ACCOUNTS`; resolved against the tenant's own chart. */
  debitCode: string;
  creditCode: string;
}

/** Most-used vouchers for a madrasa; heads follow the default chart's code blocks. */
export const JOURNAL_TEMPLATE_SEEDS: readonly JournalTemplateSeed[] = [
  {
    id: "petty-cash-expense",
    nameKey: "accounting.templates.seed.pettyCashExpense",
    debitCode: "61500",
    creditCode: "10200",
  },
  {
    id: "cash-payment",
    nameKey: "accounting.templates.seed.cashPayment",
    debitCode: "60500",
    creditCode: "10100",
  },
  {
    id: "bank-payment",
    nameKey: "accounting.templates.seed.bankPayment",
    debitCode: "61500",
    creditCode: "10300",
  },
  {
    id: "payroll",
    nameKey: "accounting.templates.seed.payroll",
    debitCode: "60100",
    creditCode: "10300",
  },
  {
    id: "utilities",
    nameKey: "accounting.templates.seed.utilities",
    debitCode: "60300",
    creditCode: "10300",
  },
  {
    id: "rent-payment",
    nameKey: "accounting.templates.seed.rentPayment",
    debitCode: "60200",
    creditCode: "10300",
  },
  {
    id: "bank-charges",
    nameKey: "accounting.templates.seed.bankCharges",
    debitCode: "61400",
    creditCode: "10300",
  },
  {
    id: "fee-collection",
    nameKey: "accounting.templates.seed.feeCollection",
    debitCode: "10100",
    creditCode: "42000",
  },
  {
    id: "donation-received",
    nameKey: "accounting.templates.seed.donationReceived",
    debitCode: "10100",
    creditCode: "43000",
  },
  {
    id: "cash-deposit",
    nameKey: "accounting.templates.seed.cashDeposit",
    debitCode: "10300",
    creditCode: "10100",
  },
  {
    id: "cash-withdrawal",
    nameKey: "accounting.templates.seed.cashWithdrawal",
    debitCode: "10100",
    creditCode: "10300",
  },
  {
    id: "petty-cash-topup",
    nameKey: "accounting.templates.seed.pettyCashTopUp",
    debitCode: "10200",
    creditCode: "10300",
  },
];

/**
 * Builds the seed templates for a chart: codes resolve to the tenant's active
 * account ids, and a code the chart does not have leaves that head blank.
 */
export function buildSeedJournalTemplates(
  accounts: readonly { id: string; code: string; isActive?: boolean }[],
  translate: (key: AppTranslationKey) => string,
): JournalTemplate[] {
  const idByCode = new Map(
    accounts
      .filter((account) => account.isActive !== false)
      .map((account) => [account.code, account.id]),
  );
  return JOURNAL_TEMPLATE_SEEDS.map((seed) => ({
    id: seed.id,
    name: translate(seed.nameKey),
    debitAccountId: idByCode.get(seed.debitCode) ?? "",
    creditAccountId: idByCode.get(seed.creditCode) ?? "",
  }));
}
