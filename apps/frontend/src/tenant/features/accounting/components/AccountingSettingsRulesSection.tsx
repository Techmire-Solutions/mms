import { type AccountingSettings, type Account } from "@mms/shared";
import { Sliders, Hash } from "lucide-react";
import { FormSelect } from "@/components/app/FormSelect";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionCard } from "@/components/app/SectionCard";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { ToggleRow } from "@shared/ui";
import { Field } from "@/components/app/FormPrimitives";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";

export interface AccountingSettingsRulesSectionProps {
  accounts: Account[];
  settingsDraft: AccountingSettings;
  upd: <K extends keyof AccountingSettings>(field: K, value: AccountingSettings[K]) => void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function AccountingSettingsRulesSection({
  accounts,
  settingsDraft,
  upd,
  isPrefsDirty,
  saving,
  saved,
  onSave,
}: AccountingSettingsRulesSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <SectionCard
        title={t("accounting.settings.secRules")}
        icon={Sliders}
        className={SETUP_SECTION_CARD_CLASS}
      >
        <div className="space-y-3">
          <ToggleRow
            label={t("accounting.settings.fields.requireNarration")}
            description={t("accounting.settings.fields.requireNarrationHint")}
            value={Boolean(settingsDraft.requireNarration)}
            onChange={(checked) => upd("requireNarration", checked)}
          />

          {/*
            "Allow editing posted entries" and "Auto-post drafts" were rendered
            here but had no consumer anywhere in the app: posted vouchers are
            immutable by design (the ledger guard rejects the edit and the row
            action only offers Edit for drafts), and nothing auto-posts. Promising
            a control with no effect is worse than not offering it; the persisted
            fields stay in the schema for backward-compatible saves.
          */}
          <ModuleSetupSaveFooter
            dirty={Boolean(isPrefsDirty)}
            saving={Boolean(saving)}
            saved={Boolean(saved)}
            saveLabel={saving ? t("global.saving") : t("common.save")}
            savedLabel={t("settings.savedBadge")}
            onSave={onSave ?? (() => {})}
            disableUnsavedGuard
            footerClassName="mt-4 pt-3"
          />
        </div>
      </SectionCard>

      <SectionCard
        title={t("accounting.settings.secNumbering")}
        icon={Hash}
        className={SETUP_SECTION_CARD_CLASS}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            id="accounting-account-code-length"
            label={t("accounting.settings.fields.defaultCodeLength")}
            hint={t("accounting.settings.fields.defaultCodeLengthHint")}
          >
            <FormSelect
              id="accounting-account-code-length"
              name="accountCodeLength"
              value={String(settingsDraft.accountCodeLength ?? 4)}
              onChange={(codeLengthValue) => upd("accountCodeLength", parseInt(codeLengthValue))}
              options={[3, 4, 5, 6].map((digitCount) => String(digitCount))}
              className="w-full sm:w-32"
            />
          </Field>

          <Field
            id="accounting-retained-earnings-account"
            label={t("accounting.settings.fields.retainedEarningsAccount")}
            hint={t("accounting.settings.fields.retainedEarningsAccountHint")}
          >
            <FormSelect
              id="accounting-retained-earnings-account"
              name="retainedEarningsAccount"
              value={settingsDraft.retainedEarningsAccount || ""}
              onChange={(accountId) => upd("retainedEarningsAccount", accountId)}
              placeholder={t("accounting.journal.form.none")}
              options={accounts
                .filter((account) => account.type === "Equity" && account.isActive !== false)
                .sort((firstAccount, secondAccount) =>
                  firstAccount.code.localeCompare(secondAccount.code),
                )
                .map((account) => ({
                  value: account.id,
                  label: `${account.code} – ${account.name}`,
                }))}
            />
          </Field>
        </div>

        <ModuleSetupSaveFooter
          dirty={Boolean(isPrefsDirty)}
          saving={Boolean(saving)}
          saved={Boolean(saved)}
          saveLabel={saving ? t("global.saving") : t("common.save")}
          savedLabel={t("settings.savedBadge")}
          onSave={onSave ?? (() => {})}
          disableUnsavedGuard
          footerClassName="mt-4 pt-3"
        />
      </SectionCard>
    </>
  );
}
