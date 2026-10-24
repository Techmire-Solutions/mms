import React from "react";
import { Link } from "react-router-dom";
import { User, Settings, Search } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ROUTES } from "@/lib/config/routes";
import { Button } from "@/components/ui/button";
import { UserNavDropdown } from "@/components/app/UserNavDropdown";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { SyncStatusBadge } from "@/tenant/components/layout/SyncStatusBadge";
import { TenantBackgroundJobsTray } from "@/tenant/components/layout/TenantBackgroundJobsTray";
import { TenantNotificationsPopover } from "@/tenant/components/layout/TenantNotificationsPopover";

export interface TopBarActionsProps {
  /** Tighter spacing for mobile header. */
  compact?: boolean;
  onOpenCommandPalette?: () => void;
  className?: string;
}

/**
 * Notifications, sync status, and user session menu — shared across desktop and mobile headers.
 */
export default function TopBarActions({
  compact = false,
  onOpenCommandPalette,
  className,
}: TopBarActionsProps): React.JSX.Element {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <div className={cn("flex shrink-0 items-center gap-1 sm:gap-2", className)}>
      {compact && onOpenCommandPalette && (
        <Button
          type="button"
          variant="outline"
          onClick={onOpenCommandPalette}
          aria-label={t("nav.globalSearchPlaceholder")}
          className="relative flex items-center justify-center rounded-lg text-xs text-muted-foreground border-border/80 hover:bg-muted/80 transition-colors cursor-pointer min-h-11 min-w-11 h-11 w-11 p-0"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      )}
      <SyncStatusBadge />
      <TenantBackgroundJobsTray compact={compact} />
      <TenantNotificationsPopover />

      {!compact ? (
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
      ) : null}

      <UserNavDropdown
        name={user?.name ?? "User"}
        email={user?.email}
        compact={compact}
        signOutLabel={t("auth.signOut")}
        onSignOut={() => logout(true)}
      >
        <DropdownMenuItem asChild>
          <Link to={ROUTES.profile}>
            <User className="me-2 h-4 w-4" aria-hidden="true" />
            {t("account.title")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={ROUTES.settings}>
            <Settings className="me-2 h-4 w-4" aria-hidden="true" />
            {t("nav.settings")}
          </Link>
        </DropdownMenuItem>
      </UserNavDropdown>
    </div>
  );
}
