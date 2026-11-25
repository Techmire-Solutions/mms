import React, { useMemo, useCallback } from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import {
  financeSettingsToSequenceConfig,
  type FinanceSettings,
  type SequenceNumberingConfig,
} from "@mms/contracts";
import { SequenceNumberingCard } from "@mms/fe-core/components/sequence-numbering";
import { ModuleSetupSaveFooter } from "@mms/fe-core/components/ModuleSetupSaveFooter";

export interface FinanceInvoiceNumberingSectionProps {
  settingsDraft: FinanceSettings;
  upd: <K extends keyof FinanceSettings>(field: K, value: FinanceSettings[K]) => void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function FinanceInvoiceNumberingSection({
  settingsDraft,
  upd,
  isPrefsDirty,
  saving,
  saved,
  onSave,
}: FinanceInvoiceNumberingSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  const config = useMemo(() => financeSettingsToSequenceConfig(settingsDraft), [settingsDraft]);

  const handleChange = useCallback(
    (next: SequenceNumberingConfig) => {
      upd("autoGenerateInvoice", next.autoGenerate);
      upd("invoicePrefix", next.prefix);
      upd("invoiceYearFormat", next.yearFormat);
      upd("invoiceSequenceDigits", next.sequenceDigits);
      upd("invoiceDelimiter", next.delimiter);
      upd("invoiceStartingSequence", next.startingSequence);
      upd("invoiceRolloverPolicy", next.rolloverPolicy);
    },
    [upd],
  );

  return (
    <SequenceNumberingCard
      title={t("finance.invoiceNumbering.title")}
      entityLabel={t("finance.invoiceNumbering.entityLabel")}
      config={config}
      onChange={handleChange}
      allowYearless={true}
      defaultPrefixPlaceholder="INV"
      footer={
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
      }
    />
  );
}
