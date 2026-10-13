import React, { useMemo, useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  studentSettingsToSequenceConfig,
  type StudentsSettings,
  type SequenceNumberingConfig,
} from "@mms/shared";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { SequenceNumberingCard } from "@/components/sequence-numbering";

export interface StudentsPreferencesSectionProps {
  settingsDraft: StudentsSettings;
  upd: <K extends keyof StudentsSettings>(field: K, value: StudentsSettings[K]) => void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

/** Students Setup Preferences body — Configures deterministic GR Number sequence. */
export function StudentsPreferencesSection({
  settingsDraft,
  upd,
  isPrefsDirty = false,
  saving = false,
  saved = false,
  onSave,
}: StudentsPreferencesSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  const config = useMemo(() => studentSettingsToSequenceConfig(settingsDraft), [settingsDraft]);

  const handleChange = useCallback(
    (next: SequenceNumberingConfig) => {
      upd("autoGenerateId", next.autoGenerate);
      upd("grNumberDigits", next.sequenceDigits);
      upd("grNumberRestartAnnually", next.rolloverPolicy !== "never");
      upd("grNumberPrefix", next.prefix);
      upd("grNumberYearFormat", next.yearFormat);
      upd("grNumberDelimiter", next.delimiter);
      upd("grNumberStartSeq", next.startingSequence);

      // Keep legacy grNumberTemplate synchronized for backend compatibility
      const prefixPart = next.prefix ? `${next.prefix}${next.delimiter}` : "";
      const yearPart =
        next.yearFormat === "YYYY"
          ? `${next.delimiter}{year}`
          : next.yearFormat === "YY"
            ? `${next.delimiter}{yy}`
            : "";
      upd("grNumberTemplate", `${prefixPart}{seq}${yearPart}`);
    },
    [upd],
  );

  return (
    <div className="space-y-4">
      <SequenceNumberingCard
        title={t("students.settings.grSectionTitle")}
        entityLabel={t("students.settings.grEntityLabel")}
        config={config}
        onChange={handleChange}
        allowYearless={true}
        defaultPrefixPlaceholder="GR"
        autoGenerateLabel={t("students.settings.autoGenerateId")}
        digitsLabel={t("students.settings.grDigits")}
        digitsHint={t("students.settings.grDigitsHint")}
        footer={
          onSave ? (
            <ModuleSetupSaveFooter
              dirty={isPrefsDirty}
              saving={saving}
              saved={saved}
              saveLabel={saving ? t("global.saving") : t("common.save")}
              savedLabel={t("settings.savedBadge")}
              onSave={onSave}
              disableUnsavedGuard
              footerClassName="mt-4 pt-3"
            />
          ) : undefined
        }
      />
    </div>
  );
}
