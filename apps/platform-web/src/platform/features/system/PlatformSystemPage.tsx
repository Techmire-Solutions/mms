import React from "react";
import { Server } from "lucide-react";
import { useTranslation } from "@mms/fe-core/i18n";
import { ModulePageShell } from "@mms/fe-core/components/ModulePageShell";
import { PlatformSystemMaintenance } from "@/platform/features/system/components/PlatformSystemMaintenance";

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
