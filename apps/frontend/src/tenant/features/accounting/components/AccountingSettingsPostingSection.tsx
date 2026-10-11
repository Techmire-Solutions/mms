import { type Account } from "@mms/shared";
import { BookOpen } from "lucide-react";
import { FormSelect } from "@/components/ui/FormSelect";
import { Field } from "@/components/ui/FormPrimitives";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  useAccountingPostingRules,
  useSaveAccountingPostingRules,
} from "@/tenant/features/accounting/hooks/useAccountingLedgerOps";
import React, { useState, useEffect } from "react";

/**
 * Mirrors the server's `POSTING_RULE_ACCOUNT_TYPES`: `arAccountId`/`cashAccountId`
 * must be Asset, `incomeAccountId` Revenue and `discountAccountId` Expense **or**
 * Revenue (contra-revenue) — offering only Expense hid every contra-revenue
 * account the server would have accepted.
 */
function accountOptions(accounts: Account[], types?: Account["type"] | Account["type"][]) {
  const allowed = types === undefined ? null : Array.isArray(types) ? types : [types];
  return accounts
    .filter((account) => account.isActive !== false && (!allowed || allowed.includes(account.type)))
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((account) => ({ value: account.id, label: `${account.code} – ${account.name}` }));
}

interface AccountingSettingsPostingSectionProps {
  accounts: Account[];
}

export function AccountingSettingsPostingSection({
  accounts,
}: AccountingSettingsPostingSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: loaded } = useAccountingPostingRules();
  const save = useSaveAccountingPostingRules();
  const [draft, setDraft] = useState({
    arAccountId: "",
    cashAccountId: "",
    incomeAccountId: "",
    discountAccountId: "",
  });

  useEffect(() => {
    if (!loaded) return;
    setDraft({
      arAccountId: loaded.arAccountId ?? "",
      cashAccountId: loaded.cashAccountId ?? "",
      incomeAccountId: loaded.incomeAccountId ?? "",
      discountAccountId: loaded.discountAccountId ?? "",
    });
  }, [loaded]);

  const handleSave = async (): Promise<void> => {
    try {
      await save.mutateAsync({
        arAccountId: draft.arAccountId || null,
        cashAccountId: draft.cashAccountId || null,
        incomeAccountId: draft.incomeAccountId || null,
        discountAccountId: draft.discountAccountId || null,
      });
      notify.success(t("accounting.settings.posting.saved"));
    } catch (error) {
      notify.error(t("accounting.settings.posting.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <SectionCard
      title={t("accounting.settings.secPosting")}
      icon={BookOpen}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <p className="m-0 mb-3 text-xs text-muted-foreground">
        {t("accounting.settings.posting.hint")}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="accounting-ar-account"
          label={t("accounting.settings.fields.arAccount")}
          hint={t("accounting.settings.fields.arAccountHint")}
        >
          <FormSelect
            id="accounting-ar-account"
            name="arAccountId"
            value={draft.arAccountId}
            onChange={(value) => setDraft((current) => ({ ...current, arAccountId: value }))}
            placeholder={t("accounting.journal.form.none")}
            options={accountOptions(accounts, "Asset")}
          />
        </Field>
        <Field
          id="accounting-cash-account"
          label={t("accounting.settings.fields.cashAccount")}
          hint={t("accounting.settings.fields.cashAccountHint")}
        >
          <FormSelect
            id="accounting-cash-account"
            name="cashAccountId"
            value={draft.cashAccountId}
            onChange={(value) => setDraft((current) => ({ ...current, cashAccountId: value }))}
            placeholder={t("accounting.journal.form.none")}
            options={accountOptions(accounts, "Asset")}
          />
        </Field>
        <Field
          id="accounting-income-account"
          label={t("accounting.settings.fields.incomeAccount")}
          hint={t("accounting.settings.fields.incomeAccountHint")}
        >
          <FormSelect
            id="accounting-income-account"
            name="incomeAccountId"
            value={draft.incomeAccountId}
            onChange={(value) => setDraft((current) => ({ ...current, incomeAccountId: value }))}
            placeholder={t("accounting.journal.form.none")}
            options={accountOptions(accounts, "Revenue")}
          />
        </Field>
        <Field
          id="accounting-discount-account"
          label={t("accounting.settings.fields.discountAccount")}
          hint={t("accounting.settings.fields.discountAccountHint")}
        >
          <FormSelect
            id="accounting-discount-account"
            name="discountAccountId"
            value={draft.discountAccountId}
            onChange={(value) => setDraft((current) => ({ ...current, discountAccountId: value }))}
            placeholder={t("accounting.journal.form.none")}
            options={accountOptions(accounts, ["Expense", "Revenue"])}
          />
        </Field>
      </div>
      <Button
        type="button"
        className="mt-4 min-h-11"
        onClick={async () => {
          await handleSave();
        }}
        disabled={save.isPending}
      >
        {t("common.save")}
      </Button>
    </SectionCard>
  );
}
