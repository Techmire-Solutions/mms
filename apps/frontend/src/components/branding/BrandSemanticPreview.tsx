import { useEffect, useState } from "react";
import {
  brandingTokenToHex,
  buildBrandingCssVariables,
  resolveBrandingChartPaletteHex,
  type BrandingThemeMode,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import type { BrandingTokens } from "./brandColorPanelShared";
import { BrandColorblindSvgFilters } from "./BrandColorblindSvgFilters";
import {
  BrandSemanticPreviewToolbar,
  type PreviewTab,
  type ColorblindFilterType,
} from "./BrandSemanticPreviewToolbar";
import { BrandSemanticPreviewActionsTab } from "./BrandSemanticPreviewActionsTab";
import { BrandSemanticPreviewDashboardTab } from "./BrandSemanticPreviewDashboardTab";
import { BrandSemanticPreviewDocumentTab } from "./BrandSemanticPreviewDocumentTab";
import { BrandSemanticPreviewTableTab } from "./BrandSemanticPreviewTableTab";

interface BrandSemanticPreviewProps {
  primaryColor: string;
  secondaryColor: string;
  previewMode: BrandingThemeMode;
  tokens: BrandingTokens;
  onPrimaryBg: string;
  onPrimaryFg: string;
  onSecondaryBg: string;
  onSecondaryFg: string;
}

export function BrandSemanticPreview({
  primaryColor,
  secondaryColor,
  previewMode,
}: BrandSemanticPreviewProps) {
  const { t } = useTranslation();
  const [localMode, setLocalMode] = useState<BrandingThemeMode>(previewMode);
  const [activeTab, setActiveTab] = useState<PreviewTab>("actions");
  const [visionFilter, setVisionFilter] = useState<ColorblindFilterType>("normal");

  useEffect(() => {
    setLocalMode(previewMode);
  }, [previewMode]);

  const activeTokens = (() => buildBrandingCssVariables(primaryColor, secondaryColor, localMode))();

  const previewContext = (() => ({
    activeOnPrimaryBg: brandingTokenToHex(activeTokens["--primary"] ?? "", primaryColor),
    activeOnPrimaryFg: brandingTokenToHex(activeTokens["--primary-foreground"] ?? "", "#ffffff"),
    activeOnSecondaryBg: brandingTokenToHex(activeTokens["--secondary"] ?? "", secondaryColor),
    activeOnSecondaryFg: brandingTokenToHex(
      activeTokens["--secondary-foreground"] ?? "",
      "#ffffff",
    ),
    activeTokens,
    chartPalette: resolveBrandingChartPaletteHex(primaryColor, secondaryColor, localMode),
  }))();

  const filterStyle =
    visionFilter !== "normal" ? { filter: `url(#mms-cb-${visionFilter})` } : undefined;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <BrandColorblindSvgFilters />

      <BrandSemanticPreviewToolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        visionFilter={visionFilter}
        onVisionFilterChange={setVisionFilter}
        localMode={localMode}
        onModeChange={setLocalMode}
        t={t}
      />

      {/* Surface Preview Sandbox Container */}
      <div style={filterStyle} className="transition-all duration-200">
        {activeTab === "actions" && <BrandSemanticPreviewActionsTab {...previewContext} />}
        {activeTab === "table" && <BrandSemanticPreviewTableTab {...previewContext} />}
        {activeTab === "dashboard" && <BrandSemanticPreviewDashboardTab {...previewContext} />}
        {activeTab === "document" && <BrandSemanticPreviewDocumentTab {...previewContext} />}
      </div>
    </div>
  );
}
