import React from "react";
import { Server } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { PlatformSystemMaintenance } from "@/platform/components/PlatformSystemMaintenance";

export default function PlatformSystemPage(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModulePageShell
      seoTitle={`${t("platform.systemMaintenance")} | ${t("platform.consoleTitle")}`}
      seoDescription={t("platform.systemMaintenanceSubtitle")}
      headerIcon={Server}
      headerTitle={t("platform.systemMaintenance")}
      headerSubtitle={t("platform.systemMaintenanceSubtitle")}
    >
      <PlatformSystemMaintenance />
    </ModulePageShell>
  );
}
