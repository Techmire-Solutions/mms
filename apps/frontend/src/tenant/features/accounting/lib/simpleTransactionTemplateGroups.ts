import { Tags } from "lucide-react";
import type { Account, AppTranslationKey, JournalTemplate } from "@mms/shared";
import { TRANSACTION_GROUPS } from "./simpleTransactionWizardGroups";
import { wizardCashAccounts } from "./simpleTransactionWizardLogic";
import type {
  QuickActionType,
  TransactionGroup,
  TransactionGroupColor,
} from "./simpleTransactionWizardTypes";

const MONEY_IN: AppTranslationKey = "accounting.journal.dashboard.group.moneyIn";
const MONEY_OUT: AppTranslationKey = "accounting.journal.dashboard.group.moneyOut";
const TRANSFERS: AppTranslationKey = "accounting.journal.dashboard.group.transfers";

/** Colour and icon per group, taken from the built-in groups so both pickers look alike. */
const GROUP_META = new Map<
  AppTranslationKey,
  { color: TransactionGroupColor; icon: TransactionGroup["icon"] }
>(TRANSACTION_GROUPS.map((group) => [group.groupKey, { color: group.color, icon: group.icon }]));

/**
 * The wizard records cash/bank movements, so a template belongs to it only when
 * one of its heads is a cash/bank account: cash on both sides is a transfer,
 * cash debited is money in, cash credited is money out. Templates with no cash
 * head (accruals, reclassifications) stay JV-only.
 */
export function classifyTemplateGroup(
  template: JournalTemplate,
  cashAccountIds: ReadonlySet<string>,
): AppTranslationKey | null {
  const debitIsCash = cashAccountIds.has(template.debitAccountId);
  const creditIsCash = cashAccountIds.has(template.creditAccountId);
  if (debitIsCash && creditIsCash) return TRANSFERS;
  if (debitIsCash) return MONEY_IN;
  if (creditIsCash) return MONEY_OUT;
  return null;
}

/** Wizard type groups built from entry templates, in Money in → Money out → Transfers order; empty groups are dropped. */
export function buildTemplateTransactionGroups(
  templates: readonly JournalTemplate[],
  accounts: readonly Account[],
): TransactionGroup[] {
  const cashAccountIds = new Set(wizardCashAccounts(accounts).map((account) => account.id));
  const itemsByGroup = new Map<AppTranslationKey, QuickActionType[]>();
  for (const template of templates) {
    const groupKey = classifyTemplateGroup(template, cashAccountIds);
    if (!groupKey) continue;
    const meta = GROUP_META.get(groupKey);
    if (!meta) continue;
    const items = itemsByGroup.get(groupKey) ?? [];
    items.push({
      id: `tpl:${template.id}`,
      labelKey: groupKey,
      label: template.name,
      icon: Tags,
      debitAcc: template.debitAccountId,
      creditAcc: template.creditAccountId,
      tag: template.name,
      descriptionKey: groupKey,
      description: template.name,
      groupKey,
      color: meta.color,
    });
    itemsByGroup.set(groupKey, items);
  }
  return [MONEY_IN, MONEY_OUT, TRANSFERS].flatMap((groupKey) => {
    const items = itemsByGroup.get(groupKey);
    const meta = GROUP_META.get(groupKey);
    return items && meta ? [{ groupKey, items, ...meta }] : [];
  });
}

/** Template groups when any template fits the wizard, otherwise the built-in groups. */
export function resolveWizardTransactionGroups(
  templates: readonly JournalTemplate[],
  accounts: readonly Account[],
): TransactionGroup[] {
  const templateGroups = buildTemplateTransactionGroups(templates, accounts);
  return templateGroups.length > 0 ? templateGroups : TRANSACTION_GROUPS;
}
