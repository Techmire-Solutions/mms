import { LayoutDashboard, BarChart2, Settings, type LucideIcon } from "lucide-react";
import type { AppTranslationKey, ModuleTierTabId } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";

export interface ModuleTierTab {
  id: ModuleTierTabId;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface ModuleTierTabsOptions {
  /** Product label for the primary operational tab (`nav.*` / entity key — not `module.work`). */
  workLabelKey: AppTranslationKey;
}

export interface FilterTabsOptions extends ModuleTierTabsOptions {
  canViewSetup?: boolean;
  canViewReports?: boolean;
}

/** Standard module page tabs with a module-named primary operational label. */
export function useModuleTierTabs(options: ModuleTierTabsOptions): ModuleTierTab[] {
  const { t } = useTranslation();
  return [
    {
      id: "work",
      label: t(options.workLabelKey),
      description: t("module.workHint"),
      icon: LayoutDashboard,
    },
    {
      id: "reports",
      label: t("module.reports"),
      description: t("module.reportsHint"),
      icon: BarChart2,
    },
    {
      id: "setup",
      label: t("module.setup"),
      description: t("module.setupHint"),
      icon: Settings,
    },
  ];
}

/**
 * Encapsulates the tier tab visibility logic for standard module pages.
 */
export function useFilteredModuleTierTabs(options: FilterTabsOptions): ModuleTierTab[] {
  const tabs = useModuleTierTabs({ workLabelKey: options.workLabelKey });
  const canViewSetup = options.canViewSetup ?? true;
  const canViewReports = options.canViewReports ?? true;

  return tabs.filter((tab) => {
    if (tab.id === "setup") return canViewSetup;
    if (tab.id === "reports") return canViewReports;
    return true;
  });
}
