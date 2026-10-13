import React from "react";
import { type AccountingSettings, type FiscalYear } from "@mms/shared";
import { Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/app/FormSelect";
import { SectionHeader } from "@/components/app/SectionHeader";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { Field } from "@/components/app/FormPrimitives";
import { SectionCard } from "@/components/app/SectionCard";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { localizedFiscalMonths } from "../lib/accountingSettingsPreferencesShared";
import { AccountingFiscalYearsTable } from "./AccountingFiscalYearsTable";

export interface AccountingSettingsFiscalYearsSectionProps {
  fiscalYears: FiscalYear[];
  settingsDraft: AccountingSettings;
  upd: <K extends keyof AccountingSettings>(field: K, value: AccountingSettings[K]) => void;
  fyStatusConfig: Record<string, StatusBadgeConfigItem>;
  canEditSetup: boolean;
  onEditFiscalYear: (fiscalYear: Partial<FiscalYear>) => void;
  /**
   * Asks the panel to confirm the (irreversible) close with a retained-earnings
   * account. It must never close the year directly: the action cannot be undone
   * and the server rejects a close that has no retained-earnings account.
   */
  onRequestCloseFiscalYear?: (fiscalYearId: string) => void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function AccountingSettingsFiscalYearsSection({
  fiscalYears,
  settingsDraft,
  upd,
  fyStatusConfig,
  canEditSetup,
  onEditFiscalYear,
  onRequestCloseFiscalYear,
  isPrefsDirty,
  saving,
  saved,
  onSave,
}: AccountingSettingsFiscalYearsSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const sortedYears = [...fiscalYears].sort((firstYear, secondYear) =>
    secondYear.startDate.localeCompare(firstYear.startDate),
  );

  return (
    <SectionCard
      title={t("accounting.settings.secFiscalYears")}
      icon={Calendar}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <Field
        id="accounting-fy-start-month"
        label={t("accounting.settings.fields.fyStartMonth")}
        hint={t("accounting.settings.fields.fyStartMonthHint")}
      >
        <FormSelect
          id="accounting-fy-start-month"
          name="fyStartMonth"
          value={settingsDraft.fyStartMonth}
          onChange={(startMonthValue) => upd("fyStartMonth", startMonthValue)}
          options={localizedFiscalMonths(t)}
          className="w-full min-w-0 sm:w-48"
        />
      </Field>

      <div className="mt-4">
        <SectionHeader
          title={
            <span className="min-w-0 text-xs font-semibold text-muted-foreground uppercase m-0">
              {t("accounting.settings.secFiscalYears")}
            </span>
          }
          actions={
            canEditSetup && (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() =>
                  onEditFiscalYear({ label: "", startDate: "", endDate: "", status: "upcoming" })
                }
                className="flex shrink-0 items-center gap-1 min-h-11 text-xs font-semibold text-primary hover:text-primary/80 transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />{" "}
                {t("accounting.settings.fy.newTitle")}
              </Button>
            )
          }
        />

        <AccountingFiscalYearsTable
          sortedYears={sortedYears}
          fyStatusConfig={fyStatusConfig}
          canEditSetup={canEditSetup}
          onEditFiscalYear={onEditFiscalYear}
          onRequestCloseFiscalYear={onRequestCloseFiscalYear}
          t={t}
        />

        <p className="m-0 mt-2 text-xs text-muted-foreground">
          {t("accounting.settings.fy.deleteNotSupported")}
        </p>
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
  );
}
