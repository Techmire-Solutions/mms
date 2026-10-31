import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X, LogOut } from "lucide-react";
import { useBranding } from "@/tenant/hooks/useBranding";
import { getInitials } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { LOGO_IMAGE } from "@/lib/ui/semanticTone";
import { ROUTES } from "@/lib/config/routes";
import { useOverlayBehavior } from "@/hooks/useOverlayBehavior";
import { MobileSidebarNavItems } from "@/tenant/components/layout/MobileSidebarNavItems";
import { useSidebarNav } from "@/tenant/components/layout/useSidebarNav";
import { cn } from "@/lib/utils";
import { OVERLAY_BACKDROP } from "@/components/ui/formStyles";

export interface MobileSidebarProps {
  /** Boolean indicating if the mobile sidebar drawer is currently visible. */
  open: boolean;
  /** Callback triggered to close the mobile sidebar (e.g. clicking the backdrop, close button, or a link). */
  onClose: () => void;
}

export default function MobileSidebar({
  open,
  onClose,
}: MobileSidebarProps): React.JSX.Element | null {
  const branding = useBranding();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const openedAtRef = useRef<number>(0);
  const [logoError, setLogoError] = useState<boolean>(false);
  const drawerRef = useOverlayBehavior<HTMLDivElement>({ open, onClose });
  const { openMenus, toggleMenu, visibleMenuItems } = useSidebarNav(false, () => {});

  const [previousLogoUrl, setPreviousLogoUrl] = useState(branding.logoUrl);

  // Reset the broken-image flag during render when the branding logo changes.
  if (previousLogoUrl !== branding.logoUrl) {
    setPreviousLogoUrl(branding.logoUrl);
    setLogoError(false);
  }

  // Record when the drawer opens so the backdrop can ignore immediate touch-through clicks.
  useEffect(() => {
    if (open) openedAtRef.current = Date.now();
  }, [open]);

  const initials = getInitials(user?.name, 2) || "AK";

  if (!open) return null;

  return (
    <div
      role="region"
      aria-label={t("nav.mobileNavigation")}
      className={cn(
        "fixed inset-0 z-sidebar-mobile lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <div
        data-overlay-backdrop
        className={cn(
          "fixed inset-0",
          OVERLAY_BACKDROP,
          "transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={() => {
          // Ignore clicks within 300ms of opening (prevents touch-through / double-tap immediately closing)
          if (Date.now() - openedAtRef.current > 300) {
            onClose();
          }
        }}
      />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.mobileNavigation")}
        className="fixed start-0 top-0 z-sidebar-mobile flex h-full w-sidebar-mobile max-w-sheet flex-col bg-sidebar shadow-drawer border-e border-sidebar-border lg:hidden"
      >
        <div className="flex h-16 flex-shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-5">
          <Link
            to={ROUTES.home}
            onClick={onClose}
            className="flex min-h-11 min-w-11 min-w-0 flex-1 items-center gap-3 overflow-hidden hover:opacity-90 transition-opacity"
          >
            {branding.logoUrl && !logoError ? (
              <img
                src={branding.logoUrl}
                alt=""
                className={`h-8 w-8 shrink-0 rounded-lg ${LOGO_IMAGE} border-sidebar-border`}
                width={32}
                height={32}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
                <span className="font-display text-lg font-bold text-sidebar-primary-foreground">
                  {branding.madrasaName ? getInitials(branding.madrasaName, 1) : "م"}
                </span>
              </div>
            )}
            <span className="min-w-0 truncate text-sm font-semibold text-sidebar-foreground">
              {branding.madrasaName || t("entry.productName")}
            </span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="min-h-11 min-w-11 h-11 w-11 p-0 text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 shrink-0 cursor-pointer"
          >
            <span className="sr-only">{t("nav.closeSidebar")}</span>
            <X className="w-5 h-5" aria-hidden="true" />
          </Button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto overscroll-contain">
          <MobileSidebarNavItems
            items={visibleMenuItems}
            openMenus={openMenus}
            onToggleMenu={toggleMenu}
            onClose={onClose}
          />
        </nav>

        <div className="shrink-0 border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {user?.name ?? "User"}
              </p>
              <p className="truncate text-xs text-sidebar-muted-foreground">{user?.email ?? ""}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full min-h-11 border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground hover:bg-sidebar-accent/50 gap-2 cursor-pointer"
            onClick={() => {
              onClose();
              logout(true);
            }}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("auth.signOut")}
          </Button>
        </div>
      </div>
    </div>
  );
}
