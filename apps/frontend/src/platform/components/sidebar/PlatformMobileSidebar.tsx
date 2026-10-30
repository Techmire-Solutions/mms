import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformSidebar } from "@/platform/lib/PlatformSidebarContext";
import { getVisiblePlatformNavSections } from "@/platform/lib/platformNav";
import { useOverlayBehavior } from "@/hooks/useOverlayBehavior";
import { PlatformSignOutDialog } from "@/platform/components/common/PlatformSignOutDialog";
import { TooltipProvider } from "@shared/ui";
import { cn } from "@/lib/utils";
import { OVERLAY_BACKDROP } from "@shared/ui";
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
  const openGestureActiveRef = useRef(false);

  useEffect(() => {
    if (!mobileOpen) return;
    openGestureActiveRef.current = true;
    const id = setTimeout(() => {
      openGestureActiveRef.current = false;
    }, 0);
    return () => clearTimeout(id);
  }, [mobileOpen]);

  const drawerRef = useOverlayBehavior<HTMLDivElement>({
    open: mobileOpen,
    onClose: closeMobileSidebar,
  });

  if (!isPlatformAuthenticated || !mobileOpen) return null;

  const sections = getVisiblePlatformNavSections(perms);

  return (
    <>
      <div
        role="region"
        aria-label={t("nav.openMenu")}
        className="lg:hidden fixed inset-0 z-sidebar-mobile flex"
      >
        <div
          data-overlay-backdrop
          className={cn("fixed inset-0", OVERLAY_BACKDROP, "transition-opacity duration-300")}
          onClick={() => {
            if (!openGestureActiveRef.current) {
              closeMobileSidebar();
            }
          }}
          aria-hidden
        />
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.openMenu")}
          className="relative w-sidebar-mobile max-w-sheet bg-sidebar h-full shadow-drawer flex flex-col z-elevated border-e border-sidebar-border"
        >
          <div className="flex flex-col justify-between h-full w-full">
            <PlatformSidebarBrand
              isMobile
              collapsed={false}
              reducedMotion={reducedMotion}
              onCloseMobile={closeMobileSidebar}
            />

            <TooltipProvider delayDuration={150}>
              <PlatformSidebarNav
                sections={sections}
                collapsed={false}
                isMobile
                reducedMotion={reducedMotion}
                closeMobileSidebar={closeMobileSidebar}
              />
            </TooltipProvider>

            <PlatformSidebarFooter
              isMobile
              collapsed={false}
              platformUser={platformUser}
              isSuperUser={isSuperUser}
              onSignOutClick={() => setConfirmSignOutOpen(true)}
              onToggleCollapsed={() => {}}
              onCloseMobile={closeMobileSidebar}
            />
          </div>
        </div>
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
