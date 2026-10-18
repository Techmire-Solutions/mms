import React from "react";
import { QrCode } from "lucide-react";
import type { AttendanceSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionCard } from "@/components/app/SectionCard";
import { ToggleRow } from "@/components/app/ToggleRow";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";

export interface AttendanceQrRulesSectionProps {
  settingsDraft: AttendanceSettings;
  upd: <K extends keyof AttendanceSettings>(key: K, value: AttendanceSettings[K]) => void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function AttendanceQrRulesSection({
  settingsDraft,
  upd,
  isPrefsDirty,
  saving,
  saved,
  onSave,
}: AttendanceQrRulesSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard
      accentColor="info"
      icon={QrCode}
      title={t("attendance.settings.qrAttendance")}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <ToggleRow
        label={t("attendance.settings.enableQr")}
        description={t("attendance.settings.enableQrDesc")}
        value={Boolean(settingsDraft.qrEnabled)}
        onChange={(value) => upd("qrEnabled", value)}
      />

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
