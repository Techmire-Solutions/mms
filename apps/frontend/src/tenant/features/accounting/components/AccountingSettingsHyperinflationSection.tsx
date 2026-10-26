import type React from "react";
import { TrendingUp } from "lucide-react";
import { type Account } from "@mms/shared";
import { DatePicker } from "@/components/app/DatePicker";
import { ErrorState } from "@/components/app/ErrorState";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { SectionCard } from "@/components/app/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { useHyperinflationPanel } from "@/tenant/features/accounting/hooks/useHyperinflationPanel";
import { accountOptions } from "@/tenant/features/accounting/lib/accountOptions";

export interface AccountingSettingsHyperinflationSectionProps {
  accounts: Account[];
  canEditSetup: boolean;
}

/** IAS 29: hyperinflationary functional currency — settings configuration. */
export function AccountingSettingsHyperinflationSection({
  accounts,
  canEditSetup,
}: AccountingSettingsHyperinflationSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const panel = useHyperinflationPanel();
  const { settings } = panel;

  return (
    <SectionCard
      title={t("accounting.settings.secIas29")}
      icon={TrendingUp}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <p className="m-0 mb-3 text-xs text-muted-foreground text-pretty">
        {t("accounting.settings.ias29.hint")}
      </p>
      {panel.settingsError ? (
        <ErrorState
          compact
          description={t("accounting.settings.ias29.loadFailed")}
          onRetry={() => void panel.refetchSettings()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="ias29-enabled" label={t("accounting.settings.ias29.enabled")}>
            <Switch
              id="ias29-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => panel.update("enabled", checked)}
              disabled={!canEditSetup}
            />
          </Field>
          <Field
            id="ias29-nmp-account"
            label={t("accounting.settings.ias29.netMonetaryAccount")}
            hint={t("accounting.settings.ias29.netMonetaryAccountHint")}
          >
            <FormSelect
              id="ias29-nmp-account"
              name="netMonetaryAccountId"
              value={settings.netMonetaryAccountId ?? ""}
              onChange={(value) => panel.update("netMonetaryAccountId", value || null)}
              placeholder={t("accounting.journal.form.none")}
              options={accountOptions(accounts, ["Revenue", "Expense"])}
              disabled={!canEditSetup}
            />
          </Field>
          <Field id="ias29-applies-from" label={t("accounting.settings.ias29.appliesFrom")}>
            <DatePicker
              id="ias29-applies-from"
              name="appliesFrom"
              value={settings.appliesFrom ?? ""}
              onChange={(value) => panel.update("appliesFrom", value || null)}
              disabled={!canEditSetup}
            />
          </Field>
          <Field id="ias29-index-name" label={t("accounting.settings.ias29.indexName")}>
            <Input
              id="ias29-index-name"
              name="indexName"
              value={settings.indexName}
              onChange={(event) => panel.update("indexName", event.target.value)}
              disabled={!canEditSetup}
            />
          </Field>
        </div>
      )}
      {canEditSetup && (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            className="min-h-11"
            onClick={() => void panel.handleSaveSettings()}
            disabled={!panel.settingsDirty || panel.savingSettings}
          >
            {t("accounting.settings.ias29.save")}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
