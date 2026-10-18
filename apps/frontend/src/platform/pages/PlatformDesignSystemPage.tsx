import React from "react";
import { Palette } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { DesignSystemGallery } from "@/platform/components/design-system/DesignSystemGallery";

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
