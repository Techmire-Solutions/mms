import React from "react";
import { Settings } from "lucide-react";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";

/** Consolidation → Setup: consolidation preferences (presentation currency is per-group). */
export function PlatformConsolidationSetupTier(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <SectionCard
      title={t("platform.consolidation.title")}
      subtitle={t("platform.consolidation.subtitle")}
      icon={Settings}
    >
      <p className="text-sm text-muted-foreground">
        {t("platform.consolidation.emptyDescription")}
      </p>
    </SectionCard>
  );
}
