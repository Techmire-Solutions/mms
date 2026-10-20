import * as React from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { UserAvatar } from "../data-display/UserAvatar";
import { Button } from "../button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu";
import { cn } from "../utils";

export interface UserNavDropdownProps {
  name?: string | null;
  email?: string | null;
  subtitle?: React.ReactNode;
  compact?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  avatarClassName?: string;
  avatarFallbackClassName?: string;
  signOutLabel: string;
  onSignOut: () => void | Promise<void>;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  children?: React.ReactNode;
}

/**
 * Universal user navigation dropdown menu primitive for topbar and header layouts.
 * Follows BiDi/RTL layout, 44x44px touch targets, and semantic design tokens.
 */
export function UserNavDropdown({
  name = "User",
  email,
  subtitle,
  compact = false,
  open,
  defaultOpen,
  onOpenChange,
  avatarClassName,
  avatarFallbackClassName,
  signOutLabel,
  onSignOut,
  className,
  triggerClassName,
  contentClassName,
  children,
}: UserNavDropdownProps): React.JSX.Element {
  const displayName = name || "User";

  return (
    <DropdownMenu open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={displayName}
          className={cn(
            "group flex items-center rounded-xl transition-colors hover:bg-muted font-normal text-start min-h-11 cursor-pointer",
            compact ? "h-11 w-11 min-w-11 p-0 justify-center" : "gap-2.5 px-2.5 py-1",
            triggerClassName,
            className,
          )}
        >
          <UserAvatar
            name={displayName}
            size={compact ? "sm" : "md"}
            className={cn(compact ? "h-7 w-7" : "h-8 w-8", avatarClassName)}
            fallbackClassName={avatarFallbackClassName}
          />
          {!compact ? (
            <>
              <div className="hidden sm:flex flex-col text-start">
                <span className="text-xs font-bold text-foreground leading-tight truncate max-w-30">
                  {displayName}
                </span>
                {subtitle ? (
                  <span className="text-2xs font-semibold text-muted-foreground flex items-center gap-1 leading-tight">
                    {subtitle}
                  </span>
                ) : email ? (
                  <span className="text-2xs text-muted-foreground truncate max-w-30">{email}</span>
                ) : null}
              </div>
              <ChevronDown
                className="hidden sm:block h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
            </>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn("w-60 p-1.5 rounded-2xl surface-overlay text-start", contentClassName)}
      >
        <DropdownMenuLabel className="p-2">
          <div className="flex flex-col text-start">
            <p className="text-sm font-black text-foreground truncate">{displayName}</p>
            {email && <p className="text-xs font-mono text-muted-foreground truncate">{email}</p>}
          </div>
        </DropdownMenuLabel>
        {children && (
          <>
            <DropdownMenuSeparator className="my-1" />
            {children}
          </>
        )}
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          className="rounded-xl font-bold text-xs gap-2 min-h-11 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
          onClick={() => {
            void onSignOut();
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {signOutLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
