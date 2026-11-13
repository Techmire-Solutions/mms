import { useCallback, useMemo, useState } from "react";
import type { Account } from "@/lib/data/accountingData";

export type AccountQuickCreateTarget =
  { kind: "line"; lineIndex: number } | { kind: "field"; field: "debitAcc" | "creditAcc" };

export interface UseAccountQuickCreateArgs {
  accounts: readonly Account[];
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
  onSelectAccount: (target: AccountQuickCreateTarget, accountId: string) => void;
}

/** Nested AccountModal create + auto-select for journal/simple account legs. */
export function useAccountQuickCreate({
  accounts,
  onAccountsChange,
  onSelectAccount,
}: UseAccountQuickCreateArgs) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<AccountQuickCreateTarget | null>(null);

  const canAdd = typeof onAccountsChange === "function";

  // Stable identities: the memoized voucher rows compare `onOpenAddAccount` by
  // reference, so a callback recreated per render would re-render every row.
  const openCreate = useCallback(
    (nextTarget: AccountQuickCreateTarget): void => {
      if (!canAdd) return;
      setTarget(nextTarget);
      setOpen(true);
    },
    [canAdd],
  );

  const close = useCallback((): void => {
    setOpen(false);
    setTarget(null);
  }, []);

  const handleSave = useCallback(
    async (account: Account): Promise<void> => {
      if (!onAccountsChange || !target) return;
      await onAccountsChange((prev) => {
        if (account.id && prev.some((existing) => existing.id === account.id)) {
          return prev.map((existing) => (existing.id === account.id ? account : existing));
        }
        return [...prev, { ...account, isActive: true }];
      });
      onSelectAccount(target, account.id);
      close();
    },
    [close, onAccountsChange, onSelectAccount, target],
  );

  const existingCodes = useMemo(() => accounts.map((account) => account.code), [accounts]);

  return {
    canAdd,
    open,
    target,
    existingCodes,
    openCreate,
    close,
    handleSave,
  };
}
