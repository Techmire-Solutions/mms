import React from "react";
import { QrCode } from "lucide-react";
import type { AttendanceSettings } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { SectionCard } from "@mms/ui";
import { ToggleRow } from "@mms/ui";
import { SETUP_SECTION_CARD_CLASS } from "@mms/ui";

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
    </SectionCard>
  );
}
