import React, { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePlatformAuth } from "@/platform/features/auth/lib/PlatformAuthContext";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformSidebar } from "@/platform/features/shell/lib/PlatformSidebarContext";
import { getVisiblePlatformNavSections } from "@/platform/features/shell/lib/platformNav";
import { MobileSidebarDrawer } from "@/components/common/MobileSidebarDrawer";
import { PlatformSignOutDialog } from "@/platform/features/shell/components/common/PlatformSignOutDialog";
import { TooltipProvider } from "@mms/ui";
import { PlatformSidebarNav } from "@/platform/features/shell/components/sidebar/PlatformSidebarNav";
import { PlatformSidebarBrand } from "@/platform/features/shell/components/sidebar/PlatformSidebarBrand";
import { PlatformSidebarFooter } from "@/platform/features/shell/components/sidebar/PlatformSidebarFooter";

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
