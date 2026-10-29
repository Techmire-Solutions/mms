import React, { useMemo, useCallback, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  obligationsSettingsToSequenceConfig,
  type SequenceNumberingConfig,
  type ObligationsSettings,
} from "@mms/shared";
import { SequenceNumberingCard } from "@/components/sequence-numbering";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { useObligationsSettings } from "@/tenant/features/obligations/hooks/useObligationsSettings";
import { notify } from "@/lib/notify";
import { ModuleSetupContent } from "@/components/app/ModuleSetupContent";

export function ObligationsReceiptNumberingSection(): React.JSX.Element {
  const { t } = useTranslation();
  const { settings, updateSettings } = useObligationsSettings();
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
    setDraft((prev) => ({
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

  const handleSave = useCallback(() => {
    updateSettings(draft);
    setSaved(true);
    notify.success(t("settings.savedBadge"));
  }, [draft, updateSettings, t]);

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
            saving={false}
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
