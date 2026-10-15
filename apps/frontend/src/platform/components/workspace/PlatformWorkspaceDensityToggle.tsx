import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { DensityToggle } from "@/components/app/DensityToggle";
import type { PlatformDensity } from "@/platform/hooks/usePlatformDensity";
import { TooltipProvider } from "@shared/ui";

export interface PlatformWorkspaceDensityToggleProps {
  density: PlatformDensity;
  onDensityChange: (density: PlatformDensity) => void;
  className?: string;
}

/** Thin platform adapter over shared `DensityToggle`. */
export function PlatformWorkspaceDensityToggle({
  density,
  onDensityChange,
  className,
}: PlatformWorkspaceDensityToggleProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <TooltipProvider delayDuration={150}>
      <DensityToggle
        density={density}
        onChange={onDensityChange}
        ariaLabel={t("dashboard.layoutDensity")}
        labels={{
          compact: t("dashboard.densityCompact"),
          standard: t("dashboard.densityStandard"),
          comfortable: t("dashboard.densityComfortable"),
        }}
        className={className}
      />
    </TooltipProvider>
  );
}
