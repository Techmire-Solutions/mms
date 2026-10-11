import React, { useState } from "react";
import { type Account } from "@mms/shared";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/FormSelect";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import { Field, FieldErrorMessage } from "@/components/ui/FormPrimitives";
import { SectionCard } from "@/components/ui/SectionCard";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { todayISO } from "@mms/shared";
import {
  hasAtMostTwoDecimals,
  parseMoneyInput,
  useBankStatements,
  useSaveBankStatement,
  type MoneySeparator,
} from "@/tenant/features/accounting/hooks/useAccountingLedgerOps";
import { accountingErrorMessage } from "@/tenant/features/accounting/hooks/useAccountingSetupSaveActions";
import { BankReconciliationMatcher } from "./BankReconciliationMatcher";

export interface AccountingSettingsBankRecSectionProps {
  accounts: Account[];
  /** `decimalSeparator` preference — money inputs must be parsed with it. */
  decimalSeparator: MoneySeparator;
}

export function AccountingSettingsBankRecSection({
  accounts,
  decimalSeparator,
}: AccountingSettingsBankRecSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: statements = [] } = useBankStatements();
  const save = useSaveBankStatement();
  const [accountId, setAccountId] = useState("");
  const [periodStart, setPeriodStart] = useState(todayISO());
  const [periodEnd, setPeriodEnd] = useState(todayISO());
  const [openingBalance, setOpeningBalance] = useState("0");
  const [closingBalance, setClosingBalance] = useState("0");
  const [lineDate, setLineDate] = useState(todayISO());
  const [lineDesc, setLineDesc] = useState("");
  const [lineAmount, setLineAmount] = useState("0");
  const [amountErrors, setAmountErrors] = useState<Record<string, string>>({});

  const clearAmountError = (field: string) => {
    setAmountErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSave = async (): Promise<void> => {
    if (!accountId) return;
    const openingValue = parseMoneyInput(openingBalance, decimalSeparator);
    const closingValue = parseMoneyInput(closingBalance, decimalSeparator);
    const lineAmountValue = parseMoneyInput(lineAmount, decimalSeparator);
    const hasLine = Boolean(lineDesc.trim());

    const nextErrors: Record<string, string> = {};
    if (openingValue === null) {
      nextErrors.openingBalance = t("accounting.settings.bankRec.invalidAmount");
    }
    if (closingValue === null) {
      nextErrors.closingBalance = t("accounting.settings.bankRec.invalidAmount");
    }
    if (hasLine && (lineAmountValue === null || !hasAtMostTwoDecimals(lineAmountValue))) {
      nextErrors.lineAmount = t("accounting.settings.bankRec.invalidAmount");
    }
    setAmountErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await save.mutateAsync({
        accountId,
        periodStart,
        periodEnd,
        openingBalance: openingValue as number,
        closingBalance: closingValue as number,
        lines: hasLine
          ? [{ date: lineDate, description: lineDesc.trim(), amount: lineAmountValue as number }]
          : [],
      });
      notify.success(t("accounting.settings.bankRec.saved"));
    } catch (error) {
      notify.error(t("accounting.settings.bankRec.saveFailed"), {
        description: accountingErrorMessage(error),
      });
    }
  };

  return (
    <SectionCard
      title={t("accounting.settings.secBankRec")}
      icon={Landmark}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <p className="m-0 mb-3 text-xs text-muted-foreground">
        {t("accounting.settings.bankRec.hint")}
      </p>
      <Field id="bank-rec-account" label={t("accounting.settings.bankRec.account")}>
        <FormSelect
          id="bank-rec-account"
          name="accountId"
          value={accountId}
          onChange={setAccountId}
          options={accounts
            .filter((account) => account.type === "Asset" && account.isActive !== false)
            .map((account) => ({ value: account.id, label: `${account.code} – ${account.name}` }))}
        />
      </Field>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DatePicker
          id="bank-period-start"
          name="periodStart"
          value={periodStart}
          onChange={setPeriodStart}
          aria-label={t("common.startDate")}
        />
        <DatePicker
          id="bank-period-end"
          name="periodEnd"
          value={periodEnd}
          onChange={setPeriodEnd}
          aria-label={t("common.endDate")}
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          id="bank-rec-opening"
          label={t("accounting.settings.bankRec.opening")}
          error={amountErrors.openingBalance}
        >
          <Input
            id="bank-rec-opening"
            name="openingBalance"
            className={FORM_INPUT}
            inputMode="decimal"
            value={openingBalance}
            onChange={(event) => {
              setOpeningBalance(event.target.value);
              clearAmountError("openingBalance");
            }}
          />
        </Field>
        <Field
          id="bank-rec-closing"
          label={t("accounting.settings.bankRec.closing")}
          error={amountErrors.closingBalance}
        >
          <Input
            id="bank-rec-closing"
            name="closingBalance"
            className={FORM_INPUT}
            inputMode="decimal"
            value={closingBalance}
            onChange={(event) => {
              setClosingBalance(event.target.value);
              clearAmountError("closingBalance");
            }}
          />
        </Field>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DatePicker
          id="bank-line-date"
          name="lineDate"
          value={lineDate}
          onChange={setLineDate}
          aria-label={t("accounting.columns.journal.date")}
        />
        <Input
          id="bank-line-desc"
          name="lineDesc"
          className={FORM_INPUT}
          value={lineDesc}
          onChange={(event) => setLineDesc(event.target.value)}
          aria-label={t("accounting.settings.bankRec.lineDesc")}
        />
        <Input
          id="bank-line-amount"
          name="lineAmount"
          className={FORM_INPUT}
          inputMode="decimal"
          value={lineAmount}
          onChange={(event) => {
            setLineAmount(event.target.value);
            clearAmountError("lineAmount");
          }}
          aria-label={t("accounting.settings.bankRec.lineAmount")}
        />
      </div>
      <FieldErrorMessage message={amountErrors.lineAmount} className="mt-2" />
      <Button
        type="button"
        className="mt-3 min-h-11"
        onClick={async () => {
          await handleSave();
        }}
        disabled={!accountId || save.isPending}
      >
        {t("accounting.settings.bankRec.add")}
      </Button>
      <p className="m-0 mt-3 text-xs text-muted-foreground">
        {t("accounting.settings.bankRec.count", { count: String(statements.length) })}
      </p>

      <BankReconciliationMatcher t={t} />
    </SectionCard>
  );
}
