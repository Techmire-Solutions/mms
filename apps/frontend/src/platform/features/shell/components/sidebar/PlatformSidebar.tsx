import React, { useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePlatformAuth } from "@/platform/features/auth/lib/PlatformAuthContext";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformSidebar } from "@/platform/features/shell/lib/PlatformSidebarContext";
import { getVisiblePlatformNavSections } from "@/platform/features/shell/lib/platformNav";
import { PlatformSignOutDialog } from "@/platform/features/shell/components/common/PlatformSignOutDialog";
import { AppSidebar } from "@/components/common/AppSidebar";
import { TooltipProvider } from "@mms/ui";
import { PlatformSidebarNav } from "@/platform/features/shell/components/sidebar/PlatformSidebarNav";
import { PlatformSidebarBrand } from "@/platform/features/shell/components/sidebar/PlatformSidebarBrand";
import { PlatformSidebarFooter } from "@/platform/features/shell/components/sidebar/PlatformSidebarFooter";

export { PlatformMobileSidebar } from "@/platform/features/shell/components/sidebar/PlatformMobileSidebar";

/**
 * Desktop navigation sidebar for Platform Apex. Mounted inside AppShell's desktop slot.
 */
export function PlatformSidebar(): React.JSX.Element | null {
  const reducedMotion = useReducedMotion();
  const { platformUser, platformLogout } = usePlatformAuth();
  const perms = usePlatformPermissions();
  const { isPlatformAuthenticated, isSuperUser } = perms;
  const { collapsed, toggleCollapsed } = usePlatformSidebar();
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
        beforeNav={null}
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
