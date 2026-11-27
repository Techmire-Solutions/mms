import React, { useMemo, useCallback, useState } from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import {
  obligationsSettingsToSequenceConfig,
  type SequenceNumberingConfig,
  type ObligationsSettings,
} from "@mms/contracts";
import { SequenceNumberingCard } from "@mms/fe-core/components/sequence-numbering";
import { ModuleSetupSaveFooter } from "@mms/fe-core/components/ModuleSetupSaveFooter";
import { useObligationsSettings } from "../hooks/useObligationsSettings";
import { notify } from "@mms/fe-core/notify";
import { ModuleSetupContent } from "@mms/ui/app/ModuleSetupContent";

export function ObligationsReceiptNumberingSection(): React.JSX.Element {
  const { t } = useTranslation();
  const { settings, updateSettingsAsync, saving } = useObligationsSettings();
  const [draft, setDraft] = useState<ObligationsSettings>(() => settings);
  const [saved, setSaved] = useState(false);
  const [previousSettings, setPreviousSettings] = useState(settings);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings],
  );

  // Adopt externally-saved settings during render while the draft has no unsaved edits.
  if (previousSettings !== settings) {
    setPreviousSettings(settings);
    if (!isDirty) setDraft(settings);
  }

  const config = useMemo(() => obligationsSettingsToSequenceConfig(draft), [draft]);

  const handleChange = useCallback((next: SequenceNumberingConfig) => {
    setDraft((prev: any) => ({
      ...prev,
      autoGenerateReceipt: next.autoGenerate,
      receiptPrefix: next.prefix,
      receiptYearFormat: next.yearFormat,
      receiptSequenceDigits: next.sequenceDigits,
      receiptDelimiter: next.delimiter,
      receiptStartingSequence: next.startingSequence,
      receiptRolloverPolicy: next.rolloverPolicy,
    }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await updateSettingsAsync(draft);
      setSaved(true);
      notify.success(t("settings.savedBadge"));
    } catch (error) {
      notify.error(t("settings.serverSaveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [draft, updateSettingsAsync, t]);

  return (
    <ModuleSetupContent>
      <SequenceNumberingCard
        title={t("obligations.receiptNumbering.title")}
        entityLabel={t("obligations.receiptNumbering.entityLabel")}
        config={config}
        onChange={handleChange}
        allowYearless={true}
        defaultPrefixPlaceholder="OBL"
        footer={
          <ModuleSetupSaveFooter
            dirty={isDirty}
            saving={saving}
            saved={saved}
            saveLabel={t("common.save")}
            savedLabel={t("settings.savedBadge")}
            onSave={handleSave}
            footerClassName="mt-4 pt-3"
          />
        }
      />
    </ModuleSetupContent>
  );
}

export default ObligationsReceiptNumberingSection;
