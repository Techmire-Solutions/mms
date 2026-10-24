import React, { useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformSidebar } from "@/platform/lib/PlatformSidebarContext";
import { getVisiblePlatformNavSections } from "@/platform/lib/platformNav";
import { PlatformSignOutDialog } from "@/platform/components/common/PlatformSignOutDialog";
import { PlatformSidebarSearch } from "@/platform/components/sidebar/PlatformSidebarSearch";
import { AppSidebar } from "@/components/common/AppSidebar";
import { TooltipProvider } from "@shared/ui";
import { PlatformSidebarNav } from "@/platform/components/PlatformSidebarNav";
import { PlatformSidebarBrand } from "@/platform/components/sidebar/PlatformSidebarBrand";
import { PlatformSidebarFooter } from "@/platform/components/sidebar/PlatformSidebarFooter";

export { PlatformMobileSidebar } from "@/platform/components/sidebar/PlatformMobileSidebar";

/**
 * Desktop navigation sidebar for Platform Apex. Mounted inside AppShell's desktop slot.
 */
export function PlatformSidebar(): React.JSX.Element | null {
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
      <AppSidebar
        collapsed={collapsed}
        brand={
          <PlatformSidebarBrand
            isMobile={false}
            collapsed={collapsed}
            reducedMotion={reducedMotion}
          />
        }
        beforeNav={!collapsed ? <PlatformSidebarSearch onOpen={openCommandPalette} /> : null}
        footer={
          <PlatformSidebarFooter
            isMobile={false}
            collapsed={collapsed}
            platformUser={platformUser}
            isSuperUser={isSuperUser}
            onSignOutClick={() => setConfirmSignOutOpen(true)}
            onToggleCollapsed={toggleCollapsed}
            onCloseMobile={() => {}}
          />
        }
      >
        <TooltipProvider delayDuration={150}>
          <PlatformSidebarNav
            sections={sections}
            collapsed={collapsed}
            isMobile={false}
            reducedMotion={reducedMotion}
            closeMobileSidebar={() => {}}
          />
        </TooltipProvider>
      </AppSidebar>

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
