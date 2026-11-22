import React, { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformSidebar } from "@/platform/lib/PlatformSidebarContext";
import { getVisiblePlatformNavSections } from "@/platform/lib/platformNav";
import { MobileSidebarDrawer } from "@/components/common/MobileSidebarDrawer";
import { PlatformSignOutDialog } from "@/platform/components/common/PlatformSignOutDialog";
import { TooltipProvider } from "@shared/ui";
import { PlatformSidebarNav } from "@/platform/components/PlatformSidebarNav";
import { PlatformSidebarBrand } from "@/platform/components/sidebar/PlatformSidebarBrand";
import { PlatformSidebarFooter } from "@/platform/components/sidebar/PlatformSidebarFooter";

/**
 * Mobile drawer for Platform Apex, mounted outside the desktop aside so it remains
 * fully visible and interactive on all viewports < 1024px.
 */
export function PlatformMobileSidebar(): React.JSX.Element | null {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { platformUser, platformLogout } = usePlatformAuth();
  const perms = usePlatformPermissions();
  const { isPlatformAuthenticated, isSuperUser } = perms;
  const { mobileOpen, closeMobileSidebar } = usePlatformSidebar();
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);

  if (!isPlatformAuthenticated || !mobileOpen) return null;

  const sections = getVisiblePlatformNavSections(perms);

  return (
    <>
      <div className="lg:hidden fixed inset-0 z-sidebar-mobile flex">
        <MobileSidebarDrawer
          open={mobileOpen}
          onClose={closeMobileSidebar}
          ariaLabel={t("platform.navAria")}
          touchGuardMs={0}
          brand={
            <PlatformSidebarBrand
              isMobile
              collapsed={false}
              reducedMotion={reducedMotion}
              onCloseMobile={closeMobileSidebar}
            />
          }
          nav={
            <TooltipProvider delayDuration={150}>
              <PlatformSidebarNav
                sections={sections}
                collapsed={false}
                isMobile
                reducedMotion={reducedMotion}
                closeMobileSidebar={closeMobileSidebar}
              />
            </TooltipProvider>
          }
          footer={
            <PlatformSidebarFooter
              isMobile
              collapsed={false}
              platformUser={platformUser}
              isSuperUser={isSuperUser}
              onSignOutClick={() => setConfirmSignOutOpen(true)}
              onToggleCollapsed={() => {}}
              onCloseMobile={closeMobileSidebar}
            />
          }
        />
      </div>

      <PlatformSignOutDialog
        open={confirmSignOutOpen}
        onOpenChange={setConfirmSignOutOpen}
        onConfirm={() => {
          closeMobileSidebar();
          void platformLogout();
        }}
      />
    </>
  );
}
