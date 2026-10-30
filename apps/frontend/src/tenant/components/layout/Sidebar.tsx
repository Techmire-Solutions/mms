import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { AppSidebar } from "@/components/common/AppSidebar";
import { SidebarBrand } from "@/tenant/components/layout/SidebarBrand";
import { SidebarNav } from "@/tenant/components/layout/SidebarNav";
import { useSidebarNav } from "@/tenant/components/layout/useSidebarNav";

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps): React.JSX.Element {
  const { t } = useTranslation();
  const { location, openMenus, toggleMenu, visibleMenuItems } = useSidebarNav(collapsed, onToggle);
  const toggleLabel = collapsed ? t("nav.expand") : t("nav.collapse");

  return (
    <AppSidebar
      collapsed={collapsed}
      brand={<SidebarBrand collapsed={collapsed} />}
      footer={
        <div className="px-3 py-4 border-t border-sidebar-border">
          <Button
            type="button"
            variant="ghost"
            onClick={onToggle}
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                <span className="text-xs font-medium">{toggleLabel}</span>
              </>
            )}
          </Button>
        </div>
      }
    >
      <SidebarNav
        collapsed={collapsed}
        locationPathname={location.pathname}
        visibleMenuItems={visibleMenuItems}
        openMenus={openMenus}
        onToggleMenu={toggleMenu}
      />
    </AppSidebar>
  );
}
