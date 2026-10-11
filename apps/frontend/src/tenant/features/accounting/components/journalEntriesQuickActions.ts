import type { AppTranslationKey } from "@mms/shared";
import type { ElementType } from "react";
import { BookOpen, Heart, TrendingUp, UserCheck, Zap } from "lucide-react";

export interface QuickActionType {
  id: string;
  labelKey: AppTranslationKey;
  icon: ElementType;
  debitAcc: string;
  creditAcc: string;
  tag: string;
  descriptionKey: AppTranslationKey;
  groupKey: AppTranslationKey;
  color: string;
  /** Literal label/description (entry templates); wins over the translation keys. */
  label?: string;
  description?: string;
}

interface QuickAction {
  labelKey: AppTranslationKey;
  icon: ElementType;
  type: QuickActionType;
}

const FEE_COLLECTION: QuickActionType = {
  id: "fee_collection",
  labelKey: "accounting.journal.dashboard.label.feeCollection",
  icon: BookOpen,
  debitAcc: "a1000",
  creditAcc: "a4000",
  tag: "Fees",
  descriptionKey: "accounting.journal.dashboard.desc.feeCollection",
  groupKey: "accounting.journal.dashboard.group.moneyIn",
  color: "emerald",
};

const SALARY_PAYMENT: QuickActionType = {
  id: "salary",
  labelKey: "accounting.journal.dashboard.label.salaryPayment",
  icon: UserCheck,
  debitAcc: "a5000",
  creditAcc: "a1010",
  tag: "Payroll",
  descriptionKey: "accounting.journal.dashboard.desc.salaryPayment",
  groupKey: "accounting.journal.dashboard.group.moneyOut",
  color: "red",
};

const DONATION_RECEIVED: QuickActionType = {
  id: "donation",
  labelKey: "accounting.journal.dashboard.label.donationReceived",
  icon: Heart,
  debitAcc: "a1000",
  creditAcc: "a4100",
  tag: "Donation",
  descriptionKey: "accounting.journal.dashboard.desc.donationReceived",
  groupKey: "accounting.journal.dashboard.group.moneyIn",
  color: "emerald",
};

const UTILITIES_PAYMENT: QuickActionType = {
  id: "utilities",
  labelKey: "accounting.journal.dashboard.label.utilities",
  icon: Zap,
  debitAcc: "a5200",
  creditAcc: "a1000",
  tag: "Utilities",
  descriptionKey: "accounting.journal.dashboard.desc.utilities",
  groupKey: "accounting.journal.dashboard.group.moneyOut",
  color: "red",
};

const OTHER_EXPENSE: QuickActionType = {
  id: "other_expense",
  labelKey: "accounting.journal.dashboard.label.otherExpense",
  icon: TrendingUp,
  debitAcc: "a5700",
  creditAcc: "a1000",
  // Was "Capital", which is an owner contribution (money IN): the quick-action
  // panel classified by tag, so a posted expense rendered as a green inflow with
  // the wrong tone while the money-in/money-out tag sets overlapped.
  tag: "Expense",
  descriptionKey: "accounting.journal.dashboard.desc.otherExpense",
  groupKey: "accounting.journal.dashboard.group.moneyOut",
  color: "red",
};

export const QUICK_ACTIONS: QuickAction[] = [
  {
    labelKey: "accounting.journal.dashboard.action.collectFee",
    icon: BookOpen,
    type: FEE_COLLECTION,
  },
  {
    labelKey: "accounting.journal.dashboard.action.paySalary",
    icon: UserCheck,
    type: SALARY_PAYMENT,
  },
  {
    labelKey: "accounting.journal.dashboard.action.recordDonation",
    icon: Heart,
    type: DONATION_RECEIVED,
  },
  {
    labelKey: "accounting.journal.dashboard.action.payUtility",
    icon: Zap,
    type: UTILITIES_PAYMENT,
  },
  {
    labelKey: "accounting.journal.dashboard.action.addExpense",
    icon: TrendingUp,
    type: OTHER_EXPENSE,
  },
];

/** Cash-flow direction of a quick action, taken from its own group. */
export type QuickActionDirection = "in" | "out";

const MONEY_IN_GROUP = "accounting.journal.dashboard.group.moneyIn";

/**
 * Cash-flow direction per quick action, derived from the action definitions
 * above rather than a second hand-maintained list — a drift between the two was
 * what let "Other expense" carry the money-in tag `Capital`.
 */
export const QUICK_ACTION_DIRECTIONS: Record<string, QuickActionDirection> = {
  ...Object.fromEntries(
    QUICK_ACTIONS.map((quickAction) => [
      quickAction.type.id,
      quickAction.type.groupKey === MONEY_IN_GROUP ? "in" : "out",
    ]),
  ),
  rent_income: "in",
  other_income: "in",
  supplies: "out",
  rent_payment: "out",
};

/** Tags of the money-in quick actions; disjoint from {@link MONEY_OUT_ACTION_TAGS} by construction. */
export const MONEY_IN_ACTION_TAGS: ReadonlySet<string> = new Set([
  ...QUICK_ACTIONS.filter((quickAction) => quickAction.type.groupKey === MONEY_IN_GROUP).map(
    (quickAction) => quickAction.type.tag,
  ),
  "Income",
]);

/** Tags of the money-out quick actions, excluding any tag claimed by money-in. */
export const MONEY_OUT_ACTION_TAGS: ReadonlySet<string> = new Set([
  ...QUICK_ACTIONS.filter(
    (quickAction) =>
      quickAction.type.groupKey !== MONEY_IN_GROUP &&
      !MONEY_IN_ACTION_TAGS.has(quickAction.type.tag),
  ).map((quickAction) => quickAction.type.tag),
  "Rent",
]);

/**
 * Direction implied by an entry's own tags / transaction type, or `null` when the
 * entry carries no cash-flow signal.
 */
export function resolveEntryDirection(entry: {
  tags?: string[] | null;
  transaction_type?: string | null;
}): QuickActionDirection | null {
  const transactionDirection = entry.transaction_type
    ? (QUICK_ACTION_DIRECTIONS[entry.transaction_type] ?? null)
    : null;
  const tags = entry.tags ?? [];
  const tagDirection: QuickActionDirection | null = tags.some((tag) =>
    MONEY_IN_ACTION_TAGS.has(tag),
  )
    ? "in"
    : tags.some((tag) => MONEY_OUT_ACTION_TAGS.has(tag))
      ? "out"
      : null;
  if (transactionDirection === "out") return "out";
  if (transactionDirection === "in") return tagDirection === "out" ? "out" : "in";
  return tagDirection;
}

export function parseNaturalLanguage(text: string): QuickActionType | null {
  const normalizedText = text.toLowerCase();
  if (normalizedText.includes("fee") || normalizedText.includes("collect")) return FEE_COLLECTION;
  if (normalizedText.includes("salary") || normalizedText.includes("pay staff"))
    return SALARY_PAYMENT;
  if (normalizedText.includes("donat")) return DONATION_RECEIVED;
  if (
    normalizedText.includes("electric") ||
    normalizedText.includes("util") ||
    normalizedText.includes("gas") ||
    normalizedText.includes("water")
  ) {
    return UTILITIES_PAYMENT;
  }
  if (
    normalizedText.includes("expense") ||
    normalizedText.includes("paid") ||
    normalizedText.includes("purchase")
  ) {
    return OTHER_EXPENSE;
  }
  return null;
}

export function extractAmountFromNaturalLanguage(text: string): string | null {
  const tokens = text.split(/\s+/);
  for (const token of tokens) {
    const cleaned = token.replace(/^[$€£Rs.\s]+/, "").replace(/,/g, "");
    if (/^\d+(?:\.\d{1,2})?$/.test(cleaned) && Number(cleaned) > 0) {
      return cleaned;
    }
  }
  return null;
}
