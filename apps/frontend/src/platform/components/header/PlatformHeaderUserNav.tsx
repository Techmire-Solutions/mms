import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, User, Users, Search, Sparkles } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformWorkspaces } from "@/platform/hooks/usePlatformWorkspaces";
import { Button, DropdownMenuItem, UserNavDropdown } from "@shared/ui";
import { BackgroundJobsTray } from "@/components/app/BackgroundJobsTray";
import { PlatformNotificationsPopover } from "@/platform/components/header/PlatformNotificationsPopover";
import { ROUTES } from "@/lib/config/routes";
import { cn } from "@/lib/utils";

export interface PlatformHeaderUserNavProps {
  compact?: boolean;
  onOpenSearch?: () => void;
  searchOpen?: boolean;
  onOpenAi?: () => void;
  aiOpen?: boolean;
  className?: string;
}

/**
 * Platform header user navigation and utilities toolbar using shared UserNavDropdown.
 */
export function PlatformHeaderUserNav({
  compact = false,
  onOpenSearch,
  searchOpen = false,
  onOpenAi,
  aiOpen = false,
  className,
}: PlatformHeaderUserNavProps): React.JSX.Element {
  const { t } = useTranslation();
  const { platformUser, platformLogout } = usePlatformAuth();
  const { isSuperUser, canAdmins } = usePlatformPermissions();
  const { data: workspaces } = usePlatformWorkspaces({ limit: 100 });

  const roleSubtitle = isSuperUser ? (
    <>
      <ShieldAlert className="w-2.5 h-2.5 text-primary shrink-0" aria-hidden="true" />
      {t("platform.roleSuperUser")}
    </>
  ) : (
    t("platform.roleAdmin")
  );

  return (
    <div className={cn("flex shrink-0 items-center gap-1 sm:gap-2", className)}>
      {onOpenSearch && (
        <Button
          type="button"
          variant="outline"
          onClick={onOpenSearch}
          aria-label={t("platform.openSearchAria")}
          aria-keyshortcuts="Control+K Meta+K"
          aria-pressed={searchOpen}
          className={cn(
            "relative flex items-center gap-2 rounded-xl text-xs text-muted-foreground border-border/80 hover:bg-muted/80 transition-colors cursor-pointer",
            compact
              ? "h-11 w-11 p-0 justify-center min-h-11 min-w-11"
              : "h-11 px-3 py-1.5 min-h-11",
            searchOpen && "ring-2 ring-primary/30 bg-muted/60",
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {!compact && (
            <>
              <span className="hidden md:inline font-normal">
                {t("platform.searchConsolePlaceholder")}
              </span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-border/80 bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground select-none font-mono">
                ⌘K
              </kbd>
            </>
          )}
        </Button>
      )}

      {onOpenAi && (
        <Button
          type="button"
          variant="outline"
          onClick={onOpenAi}
          aria-label={t("platform.aiCopilotTitle")}
          aria-keyshortcuts="Control+J Meta+J"
          aria-pressed={aiOpen}
          className={cn(
            "relative flex items-center gap-1.5 rounded-xl text-xs text-muted-foreground border-border/80 hover:bg-muted/80 transition-colors cursor-pointer",
            compact
              ? "h-11 w-11 p-0 justify-center min-h-11 min-w-11"
              : "h-11 px-3 py-1.5 min-h-11",
            aiOpen && "ring-2 ring-primary/30 bg-muted/60 text-primary",
          )}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          {!compact && (
            <>
              <span className="hidden lg:inline font-normal">{t("platform.aiCopilotTitle")}</span>
              <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border/80 bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground select-none font-mono">
                ⌘J
              </kbd>
            </>
          )}
        </Button>
      )}

      <PlatformNotificationsPopover workspaces={workspaces} isSuperUser={isSuperUser} />

      <BackgroundJobsTray compact={compact} />

      {!compact ? (
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
      ) : null}

      <UserNavDropdown
        name={platformUser?.name ?? t("platform.operatorRole")}
        email={platformUser?.email}
        subtitle={roleSubtitle}
        compact={compact}
        signOutLabel={t("platform.signOut")}
        onSignOut={platformLogout}
        avatarClassName={compact ? "h-7 w-7" : "h-8 w-8 border border-primary/20 shadow-xs"}
        avatarFallbackClassName="bg-primary/10 text-primary text-xs font-bold"
      >
        <DropdownMenuItem
          asChild
          className="rounded-xl font-bold text-xs gap-2 min-h-11 cursor-pointer"
        >
          <Link to={ROUTES.platformAccount}>
            <User className="h-4 w-4 text-warning" aria-hidden />
            {t("platform.myAccount")}
          </Link>
        </DropdownMenuItem>
        {canAdmins && (
          <DropdownMenuItem
            asChild
            className="rounded-xl font-bold text-xs gap-2 min-h-11 cursor-pointer"
          >
            <Link to={ROUTES.platformUsers}>
              <Users className="h-4 w-4 text-success" aria-hidden />
              {t("platform.adminsTitle")}
            </Link>
          </DropdownMenuItem>
        )}
      </UserNavDropdown>
    </div>
  );
}
