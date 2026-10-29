import { useMemo, useState } from "react";
import { generateClientEntityId, type Account, type FiscalYear, moneyToCents } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  hasAtMostTwoDecimals,
  parseMoneyInput,
  useOpeningBalances,
  usePostOpeningBalances,
  useSaveOpeningBalances,
  type MoneySeparator,
} from "@/tenant/features/accounting/hooks/useAccountingLedgerOps";
import { accountingErrorMessage } from "@/tenant/features/accounting/hooks/useAccountingSetupSaveActions";

function isPostableMoneyAmount(value: number | null): value is number {
  return value !== null && value >= 0 && hasAtMostTwoDecimals(value);
}

export function useAccountingOpeningBalancesState({
  accounts,
  fiscalYears,
  decimalSeparator,
}: {
  accounts: Account[];
  fiscalYears: FiscalYear[];
  decimalSeparator: MoneySeparator;
}) {
  const { t } = useTranslation();
  const openYears = useMemo(
    () =>
      fiscalYears
        .filter((year) => year.status !== "closed")
        .sort((left, right) => right.startDate.localeCompare(left.startDate)),
    [fiscalYears],
  );
  const [fiscalYearId, setFiscalYearId] = useState(openYears[0]?.id ?? "");
  const [accountId, setAccountId] = useState("");
  const [debit, setDebit] = useState("0");
  const [credit, setCredit] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);
  const openingQuery = useOpeningBalances(fiscalYearId || undefined);
  const save = useSaveOpeningBalances();
  const post = usePostOpeningBalances();

  // Keep the selected year valid when the open-year list changes — corrected
  // during render instead of in an effect.
  const openYearsKey = openYears.map((year) => year.id).join("|");
  const [fiscalYearGuard, setFiscalYearGuard] = useState({ openYearsKey, fiscalYearId });
  if (
    fiscalYearGuard.openYearsKey !== openYearsKey ||
    fiscalYearGuard.fiscalYearId !== fiscalYearId
  ) {
    const nextFiscalYearId = openYears.some((year) => year.id === fiscalYearId)
      ? fiscalYearId
      : (openYears[0]?.id ?? "");
    setFiscalYearGuard({ openYearsKey, fiscalYearId: nextFiscalYearId });
    if (nextFiscalYearId !== fiscalYearId) {
      setFiscalYearId(nextFiscalYearId);
      setFormError(null);
    }
  }

  const balances = useMemo(() => openingQuery.data ?? [], [openingQuery.data]);
  const rowsReady = openingQuery.isSuccess && !openingQuery.isPlaceholderData;

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const accountLabel = (rowAccountId: string): string => {
    const account = accountById.get(rowAccountId);
    return account ? `${account.code} – ${account.name}` : rowAccountId;
  };

  const totals = useMemo(() => {
    const debitCents = balances.reduce((sum, row) => sum + moneyToCents(row.debit), 0);
    const creditCents = balances.reduce((sum, row) => sum + moneyToCents(row.credit), 0);
    const singleSided = balances.every((row) => !(row.debit > 0 && row.credit > 0));
    return {
      debitCents,
      creditCents,
      singleSided,
      balanced: debitCents === creditCents,
      postable: balances.length > 0 && singleSided && debitCents === creditCents,
    };
  }, [balances]);

  const postBlockedReason = !rowsReady
    ? null
    : balances.length === 0
      ? t("accounting.settings.opening.postBlockedEmpty")
      : !totals.singleSided
        ? t("accounting.settings.opening.postBlockedSingleSided")
        : !totals.balanced
          ? t("accounting.settings.opening.postBlockedUnbalanced")
          : null;

  const payloadRows = () =>
    balances.map((row) => ({
      id: row.id,
      fiscalYearId,
      accountId: row.accountId,
      debit: row.debit,
      credit: row.credit,
    }));

  const handleAdd = async (): Promise<void> => {
    if (!fiscalYearId || !accountId || !rowsReady) return;
    const debitValue = parseMoneyInput(debit, decimalSeparator);
    const creditValue = parseMoneyInput(credit, decimalSeparator);
    if (!isPostableMoneyAmount(debitValue) || !isPostableMoneyAmount(creditValue)) {
      setFormError(t("accounting.settings.opening.invalidAmount"));
      return;
    }
    if (debitValue > 0 && creditValue > 0) {
      setFormError(t("accounting.settings.opening.singleSidedError"));
      return;
    }
    setFormError(null);
    try {
      await save.mutateAsync({
        fiscalYearId,
        balances: [
          ...payloadRows(),
          {
            id: generateClientEntityId("ob", "-"),
            fiscalYearId,
            accountId,
            debit: debitValue,
            credit: creditValue,
          },
        ],
      });
      setDebit("0");
      setCredit("0");
      notify.success(t("accounting.settings.opening.saved"));
    } catch (error) {
      notify.error(t("accounting.settings.opening.saveFailed"), {
        description: accountingErrorMessage(error),
      });
    }
  };

  const handleRemove = async (balanceId: string): Promise<void> => {
    if (!fiscalYearId || !rowsReady) return;
    try {
      await save.mutateAsync({
        fiscalYearId,
        balances: payloadRows().filter((row) => row.id !== balanceId),
      });
      notify.success(t("accounting.settings.opening.saved"));
    } catch (error) {
      notify.error(t("accounting.settings.opening.saveFailed"), {
        description: accountingErrorMessage(error),
      });
    }
  };

  const handlePost = async (): Promise<void> => {
    if (!fiscalYearId || !rowsReady || !totals.postable) return;
    try {
      const result = await post.mutateAsync(fiscalYearId);
      if (result.posted) {
        notify.success(t("accounting.settings.opening.posted"));
      } else {
        notify.info(t("accounting.settings.opening.alreadyPosted"));
      }
    } catch (error) {
      notify.error(t("accounting.settings.opening.postFailed"), {
        description: accountingErrorMessage(error),
      });
    }
  };

  return {
    t,
    openYears,
    fiscalYearId,
    setFiscalYearId,
    accountId,
    setAccountId,
    debit,
    setDebit,
    credit,
    setCredit,
    formError,
    balances,
    rowsReady,
    accountLabel,
    totals,
    postBlockedReason,
    handleAdd,
    handleRemove,
    handlePost,
    savePending: save.isPending,
    postPending: post.isPending,
    isError: openingQuery.isError,
  };
}
