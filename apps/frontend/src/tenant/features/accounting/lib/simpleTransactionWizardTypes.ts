import type { ElementType } from "react";
import type { Account, AppTranslationKey } from "@mms/shared";
import type { QuickActionType } from "./journalEntriesQuickActions";

export type { QuickActionType };
export type TransactionGroupColor = "emerald" | "red" | "blue";

export interface TransactionGroup {
  groupKey: AppTranslationKey;
  color: TransactionGroupColor;
  icon: ElementType;
  items: QuickActionType[];
}

export interface WizardFormState {
  date: string;
  amount: string;
  debitAcc: string;
  creditAcc: string;
  description: string;
  ref: string;
  /**
   * Kept for state compatibility only: nothing uploads this file, so the wizard
   * no longer offers a receipt control it would silently drop.
   */
  receipt: string;
  fiscal_year: string;
  tags?: string[];
}

export interface WizardAccountOption {
  value: string;
  label: string;
}

export interface WizardPrefillSelection {
  debitAcc: string;
  creditAcc: string;
}

export interface WizardFormDefaults {
  date: string;
  fiscalYearLabel: string;
}

export type WizardValidationResult =
  | { ok: true; amount: number; debitAccount: Account; creditAccount: Account }
  | { ok: false; errorKey: AppTranslationKey };

export {
  TRANSACTION_GROUP_COLORS,
  getTransactionGroupColorClasses,
  TRANSACTION_GROUPS,
} from "./simpleTransactionWizardGroups";

export {
  isUsableWizardAccount,
  isLiquidAsset,
  wizardCashAccounts,
  calculateAccountBalanceCents,
  wizardAccountOptions,
  wizardCategoryAccountOptions,
  resolveSimpleTransactionAccounts,
  buildWizardFormState,
  validateWizardForm,
} from "./simpleTransactionWizardLogic";
