import React, { useMemo, useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  facultySettingsToSequenceConfig,
  buildSequenceFormulaTemplate,
  type FacultySettings,
  type SequenceNumberingConfig,
} from "@mms/shared";
import { SequenceNumberingCard } from "@/components/sequence-numbering";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";

export interface FacultyIdSettingsCardProps {
  settingsDraft: FacultySettings;
  upd: <K extends keyof FacultySettings>(field: K, value: FacultySettings[K]) => void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function FacultyIdSettingsCard({
  settingsDraft,
  upd,
  isPrefsDirty,
  saving,
  saved,
  onSave,
}: FacultyIdSettingsCardProps): React.JSX.Element {
  const { t } = useTranslation();

  const config = useMemo(() => facultySettingsToSequenceConfig(settingsDraft), [settingsDraft]);

  const handleChange = useCallback(
    (next: SequenceNumberingConfig) => {
      upd("autoGenerateId", next.autoGenerate);
      upd("employeeIdPrefix", next.prefix);
      upd("idPrefix", next.prefix);
      upd("employeeIdYearFormat", next.yearFormat as "YYYY" | "YY");
      upd("employeeIdSequenceDigits", next.sequenceDigits);
      upd("idDigits", next.sequenceDigits);
      upd("employeeIdDelimiter", next.delimiter);
      upd("idStartSeq", next.startingSequence);
      upd("idRestartAnnually", next.rolloverPolicy !== "never");
      upd("idTemplate", buildSequenceFormulaTemplate(next));
    },
    [upd],
  );

  return (
    <SequenceNumberingCard
      title={t("faculty.settings.idSectionTitle")}
      entityLabel={t("faculty.field.employeeId")}
      config={config}
      onChange={handleChange}
      defaultPrefixPlaceholder="FAC"
      autoGenerateLabel={t("faculty.settings.autoGenerateId")}
      prefixLabel={t("faculty.settings.idPrefix")}
      prefixHint={t("faculty.settings.idPrefixHint")}
      restartLabel={t("faculty.settings.idRestartAnnually")}
      restartDesc={t("faculty.settings.idRestartAnnuallyDesc")}
      footer={
        onSave ? (
          <ModuleSetupSaveFooter
            dirty={Boolean(isPrefsDirty)}
            saving={Boolean(saving)}
            saved={Boolean(saved)}
            saveLabel={saving ? t("global.saving") : t("common.save")}
            savedLabel={t("settings.savedBadge")}
            onSave={onSave}
            disableUnsavedGuard
            footerClassName="mt-4 pt-3"
          />
        ) : undefined
      }
    />
  );
}
