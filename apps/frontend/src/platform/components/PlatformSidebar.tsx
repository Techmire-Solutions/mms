import React, { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformSidebar } from "@/platform/lib/PlatformSidebarContext";
import { getVisiblePlatformNavSections } from "@/platform/lib/platformNav";
import { PlatformSignOutDialog } from "@/platform/components/common/PlatformSignOutDialog";
import { PlatformSidebarSearch } from "@/platform/components/sidebar/PlatformSidebarSearch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PlatformSidebarNav } from "@/platform/components/PlatformSidebarNav";
import { PlatformSidebarBrand } from "@/platform/components/sidebar/PlatformSidebarBrand";
import { PlatformSidebarFooter } from "@/platform/components/sidebar/PlatformSidebarFooter";

export { PlatformMobileSidebar } from "@/platform/components/sidebar/PlatformMobileSidebar";

/**
 * Desktop navigation sidebar for Platform Apex. Mounted inside AppShell's desktop slot.
 */
export function PlatformSidebar(): React.JSX.Element | null {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { platformUser, platformLogout } = usePlatformAuth();
  const perms = usePlatformPermissions();
  const { isPlatformAuthenticated, isSuperUser } = perms;
  const { collapsed, toggleCollapsed, openCommandPalette } = usePlatformSidebar();
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState<boolean>(false);

  if (!isPlatformAuthenticated) return null;

  const sections = getVisiblePlatformNavSections(perms);

  return (
    <>
      <div
        className={cn(
          "flex h-dvh shrink-0 border-e border-sidebar-border bg-sidebar transition-all duration-200 ease-out motion-reduce:transition-none flex-col justify-between select-none z-sidebar",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar",
        )}
        aria-label={t("platform.navAria")}
      >
        <div className="flex flex-col justify-between h-full w-full">
          <PlatformSidebarBrand
            isMobile={false}
            collapsed={collapsed}
            reducedMotion={reducedMotion}
          />

          {!collapsed && <PlatformSidebarSearch onOpen={openCommandPalette} />}

          <TooltipProvider delayDuration={150}>
            <PlatformSidebarNav
              sections={sections}
              collapsed={collapsed}
              isMobile={false}
              reducedMotion={reducedMotion}
              closeMobileSidebar={() => {}}
            />
          </TooltipProvider>

          <PlatformSidebarFooter
            isMobile={false}
            collapsed={collapsed}
            platformUser={platformUser}
            isSuperUser={isSuperUser}
            onSignOutClick={() => setConfirmSignOutOpen(true)}
            onToggleCollapsed={toggleCollapsed}
            onCloseMobile={() => {}}
          />
        </div>
      </div>

      <PlatformSignOutDialog
        open={confirmSignOutOpen}
        onOpenChange={setConfirmSignOutOpen}
        onConfirm={() => {
          void platformLogout();
        }}
      />
    </>
  );
}

export default PlatformSidebar;
