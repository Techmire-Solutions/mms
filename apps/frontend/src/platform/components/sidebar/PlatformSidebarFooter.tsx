import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, LogOut, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/app/SectionLabel";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/config/routes";
import type { PlatformUserProfile } from "@mms/shared";

export interface PlatformSidebarFooterProps {
  isMobile?: boolean;
  collapsed: boolean;
  platformUser: PlatformUserProfile | null;
  isSuperUser: boolean;
  onSignOutClick: () => void;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

export function PlatformSidebarFooter({
  isMobile = false,
  collapsed,
  platformUser,
  isSuperUser,
  onSignOutClick,
  onToggleCollapsed,
  onCloseMobile,
}: PlatformSidebarFooterProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="px-3 py-3 border-t border-sidebar-border space-y-2 shrink-0">
      {(isMobile || !collapsed) && (
        <Link
          to={ROUTES.platformAccount}
          onClick={() => isMobile && onCloseMobile()}
          className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-sidebar-accent/50 transition-colors group cursor-pointer"
          aria-label={t("platform.myAccount")}
        >
          <UserAvatar
            name={platformUser?.name}
            className="h-9 w-9 ring-1 ring-sidebar-border group-hover:ring-sidebar-primary/50 transition-all"
            fallbackClassName="bg-sidebar-primary/20 text-sidebar-primary text-xs font-bold"
          />
          <div className="flex flex-col text-start min-w-0 flex-1">
            <span className="text-xs font-bold text-sidebar-foreground truncate group-hover:text-sidebar-primary transition-colors">
              {platformUser?.name}
            </span>
            <SectionLabel
              tracking="wider"
              className="flex items-center gap-1 mt-0.5 text-sidebar-muted-foreground truncate"
            >
              {isSuperUser ? (
                <>
                  <ShieldAlert className="w-2.5 h-2.5 text-sidebar-primary shrink-0" aria-hidden />
                  {t("platform.roleSuperUser")}
                </>
              ) : (
                t("platform.roleAdmin")
              )}
            </SectionLabel>
          </div>
        </Link>
      )}

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          icon={LogOut}
          onClick={onSignOutClick}
          className={cn(
            "flex min-h-11 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sidebar-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer shadow-none",
            !isMobile && collapsed && "justify-center px-0 min-w-11",
          )}
          title={t("platform.signOut")}
          aria-label={t("platform.signOut")}
        >
          {(isMobile || !collapsed) && (
            <span className="text-xs font-medium truncate">{t("platform.signOut")}</span>
          )}
        </Button>

        {!isMobile && (
          <Button
            type="button"
            variant="ghost"
            icon={collapsed ? ChevronRight : ChevronLeft}
            onClick={onToggleCollapsed}
            className="h-11 w-11 min-w-11 shrink-0 rounded-lg p-0 text-sidebar-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors cursor-pointer shadow-none [&_svg]:rtl:rotate-180"
            title={collapsed ? t("nav.expand") : t("nav.collapse")}
            aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
            aria-expanded={!collapsed}
          />
        )}
      </div>
    </div>
  );
}
