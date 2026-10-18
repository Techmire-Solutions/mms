import React from "react";
import { BarChart3, Eye, IdCard, LayoutGrid, Moon, Sparkles, Sun, Table } from "lucide-react";
import type { BrandingThemeMode } from "@mms/shared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export type PreviewTab = "actions" | "table" | "document" | "dashboard";
export type ColorblindFilterType =
  "normal" | "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";

interface BrandSemanticPreviewToolbarProps {
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  visionFilter: ColorblindFilterType;
  onVisionFilterChange: (filter: ColorblindFilterType) => void;
  localMode: BrandingThemeMode;
  onModeChange: (mode: BrandingThemeMode) => void;
  t: TranslationFunction;
}

export function BrandSemanticPreviewToolbar({
  activeTab,
  onTabChange,
  visionFilter,
  onVisionFilterChange,
  localMode,
  onModeChange,
  t,
}: BrandSemanticPreviewToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
        <p className="text-xs font-semibold text-foreground">{t("theme.semanticPreviewTitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Surface View Switcher */}
        <div
          className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5"
          role="tablist"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={activeTab === "actions"}
            onClick={() => onTabChange("actions")}
            className={cn(
              "min-h-11 px-3 text-xs font-medium rounded-md transition-all",
              activeTab === "actions"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5 me-1.5" />
            {t("theme.previewTabActions")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={activeTab === "table"}
            onClick={() => onTabChange("table")}
            className={cn(
              "min-h-11 px-3 text-xs font-medium rounded-md transition-all",
              activeTab === "table"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Table className="h-3.5 w-3.5 me-1.5" />
            {t("theme.previewTabTable")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={activeTab === "dashboard"}
            onClick={() => onTabChange("dashboard")}
            className={cn(
              "min-h-11 px-3 text-xs font-medium rounded-md transition-all",
              activeTab === "dashboard"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BarChart3 className="h-3.5 w-3.5 me-1.5" />
            {t("theme.previewTabDashboard")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={activeTab === "document"}
            onClick={() => onTabChange("document")}
            className={cn(
              "min-h-11 px-3 text-xs font-medium rounded-md transition-all",
              activeTab === "document"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <IdCard className="h-3.5 w-3.5 me-1.5" />
            {t("theme.previewTabDocument")}
          </Button>
        </div>

        {/* Colorblindness Simulator Selector */}
        <div className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          <Select
            value={visionFilter}
            onValueChange={(val) => onVisionFilterChange(val as ColorblindFilterType)}
          >
            <SelectTrigger
              aria-label={t("theme.colorblindFilter")}
              className="h-11 min-h-11 min-w-36 text-xs font-medium"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal" className="text-xs">
                {t("theme.colorblindNormal")}
              </SelectItem>
              <SelectItem value="protanopia" className="text-xs">
                {t("theme.colorblindProtanopia")}
              </SelectItem>
              <SelectItem value="deuteranopia" className="text-xs">
                {t("theme.colorblindDeuteranopia")}
              </SelectItem>
              <SelectItem value="tritanopia" className="text-xs">
                {t("theme.colorblindTritanopia")}
              </SelectItem>
              <SelectItem value="achromatopsia" className="text-xs">
                {t("theme.colorblindAchromatopsia")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Light / Dark Mode Toggle */}
        <div
          className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-0.5"
          role="group"
          aria-label={t("theme.previewModeToggle")}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onModeChange("light")}
            aria-pressed={localMode === "light"}
            className={cn(
              "min-h-11 px-3 text-xs font-semibold rounded-md transition-all",
              localMode === "light"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sun className="h-3.5 w-3.5 me-1" aria-hidden />
            {t("theme.previewModeLight")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onModeChange("dark")}
            aria-pressed={localMode === "dark"}
            className={cn(
              "min-h-11 px-3 text-xs font-semibold rounded-md transition-all",
              localMode === "dark"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Moon className="h-3.5 w-3.5 me-1" aria-hidden />
            {t("theme.previewModeDark")}
          </Button>
        </div>
      </div>
    </div>
  );
}
