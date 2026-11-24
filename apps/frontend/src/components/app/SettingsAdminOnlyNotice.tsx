import React from "react";
import { ShieldAlert, type LucideIcon } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";

interface SettingsAdminOnlyNoticeProps {
  titleKey?: AppTranslationKey;
  descKey?: AppTranslationKey;
  icon?: LucideIcon;
}

/** Shown in place of an admin-only settings section for a non-admin viewer. */
export function SettingsAdminOnlyNotice({
  titleKey = "settings.adminOnlyTitle",
  descKey = "settings.adminOnlyDesc",
  icon = ShieldAlert,
}: SettingsAdminOnlyNoticeProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <SectionCard title={t(titleKey)} icon={icon}>
      <p className="text-xs leading-relaxed text-muted-foreground">{t(descKey)}</p>
    </SectionCard>
  );
}
