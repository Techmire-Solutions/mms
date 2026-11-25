import React from "react";
import { Activity } from "lucide-react";
import { useTranslation } from "@mms/fe-core/i18n";
import { ModulePageShell } from "@mms/fe-core/components/ModulePageShell";
import PlatformActivityLogsContent from "@/platform/features/activity-logs/components/PlatformActivityLogsContent";

export default function PlatformActivityLogsPage(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModulePageShell
      seoTitle={`${t("platform.activityLogsTitle")} | ${t("platform.consoleTitle")}`}
      seoDescription={t("platform.activityLogsSubtitle")}
      headerIcon={Activity}
      headerTitle={t("platform.activityLogsTitle")}
      headerSubtitle={t("platform.activityLogsSubtitle")}
    >
      <PlatformActivityLogsContent />
    </ModulePageShell>
  );
}
