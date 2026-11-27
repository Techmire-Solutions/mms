import { postingRulesUpdateSchema, type Account, type PostingRules } from "@mms/contracts";
import { BookOpen } from "lucide-react";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { accountOptions } from "./index";
import { Field, FieldErrorMessage } from "@mms/ui";
import { SectionCard } from "@mms/ui";
import { Button } from "@mms/ui";
import { SETUP_SECTION_CARD_CLASS } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import { useAccountingPostingRules, useSaveAccountingPostingRules } from "./index";
import React, { useState } from "react";
import { AccountingSettingsFxPostingFields } from "./index";

/**
 * Mirrors the server's `POSTING_RULE_ACCOUNT_TYPES`: `arAccountId`/`cashAccountId`
 * must be Asset, `incomeAccountId` Revenue and `discountAccountId` Expense **or**
 * Revenue (contra-revenue) — offering only Expense hid every contra-revenue
 * account the server would have accepted.
 */
interface AccountingSettingsPostingSectionProps {
  accounts: Account[];
}

interface PostingDraft {
  arAccountId: string;
  cashAccountId: string;
  incomeAccountId: string;
  discountAccountId: string;
  fxRealizedAccountId: string;
  fxUnrealizedAccountId: string;
  fxRoundingAccountId: string;
  ctaAccountId: string;
}

const postingDraftFrom = (rules: PostingRules | undefined): PostingDraft => ({
  arAccountId: rules?.arAccountId ?? "",
  cashAccountId: rules?.cashAccountId ?? "",
  incomeAccountId: rules?.incomeAccountId ?? "",
  discountAccountId: rules?.discountAccountId ?? "",
  fxRealizedAccountId: rules?.fxRealizedAccountId ?? "",
  fxUnrealizedAccountId: rules?.fxUnrealizedAccountId ?? "",
  fxRoundingAccountId: rules?.fxRoundingAccountId ?? "",
  ctaAccountId: rules?.ctaAccountId ?? "",
});

export function AccountingSettingsPostingSection({
  accounts,
}: AccountingSettingsPostingSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: loaded } = useAccountingPostingRules();
  const save = useSaveAccountingPostingRules();
  const [draft, setDraft] = useState<PostingDraft>(() => postingDraftFrom(loaded));
  const [error, setError] = useState<string | null>(null);

  // Adopt the server rules whenever new ones arrive, during render rather than
  // in an effect that would render the stale draft once more.
  const loadedKey = loaded ? JSON.stringify(postingDraftFrom(loaded)) : "";
  const [prevLoadedKey, setPrevLoadedKey] = useState(loadedKey);
  if (prevLoadedKey !== loadedKey) {
    setPrevLoadedKey(loadedKey);
    if (loaded) setDraft(postingDraftFrom(loaded));
  }

  const handleSave = async (): Promise<void> => {
    const body = {
      arAccountId: draft.arAccountId || null,
      cashAccountId: draft.cashAccountId || null,
      incomeAccountId: draft.incomeAccountId || null,
      discountAccountId: draft.discountAccountId || null,
      fxRealizedAccountId: draft.fxRealizedAccountId || null,
      fxUnrealizedAccountId: draft.fxUnrealizedAccountId || null,
      fxRoundingAccountId: draft.fxRoundingAccountId || null,
      ctaAccountId: draft.ctaAccountId || null,
    };
    if (!postingRulesUpdateSchema.safeParse(body).success) {
      setError(t("accounting.settings.posting.invalid"));
      return;
    }
    setError(null);
    try {
      await save.mutateAsync({
        arAccountId: draft.arAccountId || null,
        cashAccountId: draft.cashAccountId || null,
        incomeAccountId: draft.incomeAccountId || null,
        discountAccountId: draft.discountAccountId || null,
        fxRealizedAccountId: draft.fxRealizedAccountId || null,
        fxUnrealizedAccountId: draft.fxUnrealizedAccountId || null,
        fxRoundingAccountId: draft.fxRoundingAccountId || null,
        ctaAccountId: draft.ctaAccountId || null,
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
      <AccountingSettingsFxPostingFields
        accounts={accounts}
        draft={draft}
        onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
        accountOptions={accountOptions}
      />
      <FieldErrorMessage message={error ?? undefined} className="mt-3" />
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
