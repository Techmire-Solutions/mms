import React from "react";
import { Palette } from "lucide-react";
import { useTranslation } from "@mms/fe-core/i18n";
import { ModulePageShell } from "@mms/fe-core/components/ModulePageShell";
import { DesignSystemGallery } from "@/platform/features/design-system/components/DesignSystemGallery";

export default function PlatformDesignSystemPage(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModulePageShell
      seoTitle={`${t("platform.designSystemTitle")} | ${t("platform.consoleTitle")}`}
      seoDescription={t("platform.designSystemSubtitle")}
      headerIcon={Palette}
      headerTitle={t("platform.designSystemTitle")}
      headerSubtitle={t("platform.designSystemSubtitle")}
    >
      <DesignSystemGallery />
    </ModulePageShell>
  );
}
