import React from "react";
import { BarChart3 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { PlatformReportsTier } from "@/platform/components/tiers/PlatformReportsTier";

export default function PlatformReportsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { platformUser, isSuperUser } = usePlatformPermissions();

  const userName = platformUser?.name ?? "";
  const subtitle = isSuperUser
    ? t("platform.consoleSubtitle", { name: userName })
    : t("platform.adminConsoleSubtitle", { name: userName });

  return (
    <ModulePageShell
      seoTitle={`${t("module.reports")} | ${t("platform.consoleTitle")}`}
      seoDescription={subtitle}
      headerIcon={BarChart3}
      headerTitle={t("module.reports")}
      headerSubtitle={subtitle}
    >
      <PlatformReportsTier />
    </ModulePageShell>
  );
}
