import React from "react";
import { Activity } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModulePageShell } from "@/components/ui/ModulePageShell";
import PlatformActivityLogsContent from "@/platform/components/PlatformActivityLogsContent";

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
