import { useState } from "react";
import {
  BRAND_FOREGROUND_WHITE_HEX,
  brandingTokenToHex,
  buildBrandingCssVariables,
  resolveBrandingChartPaletteHex,
  type BrandingThemeMode,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
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

  // Adopt an externally changed preview mode; adjusted during render (React's
  // documented prop-change pattern) so the preview never paints with the stale mode.
  const [previousPreviewMode, setPreviousPreviewMode] = useState(previewMode);
  if (previousPreviewMode !== previewMode) {
    setPreviousPreviewMode(previewMode);
    setLocalMode(previewMode);
  }

  const activeTokens = (() => buildBrandingCssVariables(primaryColor, secondaryColor, localMode))();

  const previewContext = (() => ({
    activeOnPrimaryBg: brandingTokenToHex(activeTokens["--primary"] ?? "", primaryColor),
    activeOnPrimaryFg: brandingTokenToHex(
      activeTokens["--primary-foreground"] ?? "",
      BRAND_FOREGROUND_WHITE_HEX,
    ),
    activeOnSecondaryBg: brandingTokenToHex(activeTokens["--secondary"] ?? "", secondaryColor),
    activeOnSecondaryFg: brandingTokenToHex(
      activeTokens["--secondary-foreground"] ?? "",
      BRAND_FOREGROUND_WHITE_HEX,
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
