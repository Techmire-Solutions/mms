import React, { useState } from "react";
import { Bell } from "lucide-react";
import { Badge } from "../button/Badge";
import { Button } from "../button/Button";
import { EmptyState } from "./EmptyState";
import { Popover, PopoverContent, PopoverTrigger } from "../popover/Popover";
import { cn } from "../utils";

export interface NotificationItem {
  id: string;
  title: string;
  desc?: string;
  time?: string;
  urgent?: boolean;
  /** Read items drop the unread tint and dot emphasis. */
  read?: boolean;
  href?: string;
  onClick?: () => void;
}

export interface NotificationsPopoverProps {
  notifications: NotificationItem[];
  unreadCount?: number;
  title: string;
  emptyText?: string;
  ariaLabel?: string;
  newBadgeLabel?: string;
  viewAllLabel?: string;
  onViewAll?: () => void;
  onOpenChange?: (open: boolean) => void;
  onSelectNotification?: (item: NotificationItem) => void;
  buttonClassName?: string;
  contentClassName?: string;
  children?: React.ReactNode;
}

/**
 * Universal polymorphic notifications popover primitive for platform and tenant apps.
 * Follows BiDi/RTL, 44x44px touch targets, and semantic design tokens.
 */
export function NotificationsPopover({
  notifications,
  unreadCount = notifications.length,
  title,
  emptyText = "No notifications",
  ariaLabel = "Notifications",
  newBadgeLabel,
  viewAllLabel,
  onViewAll,
  onOpenChange,
  onSelectNotification,
  buttonClassName,
  contentClassName,
  children,
}: NotificationsPopoverProps): React.JSX.Element {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    onOpenChange?.(open);
  };

  const handleItemClick = (item: NotificationItem) => {
    setPopoverOpen(false);
    if (item.onClick) {
      item.onClick();
    } else if (onSelectNotification) {
      onSelectNotification(item);
    }
  };

  return (
    <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          className={cn(
            "relative min-h-11 min-w-11 h-11 w-11 rounded-xl hover:bg-muted transition-colors cursor-pointer",
            buttonClassName,
          )}
        >
          <Bell className="h-4.5 w-4.5 text-muted-foreground" aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          "w-popover-menu max-w-full p-0 rounded-2xl surface-overlay text-start",
          contentClassName,
        )}
      >
        {popoverOpen && (
          <>
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground text-balance">{title}</h3>
                {unreadCount > 0 &&
                  (newBadgeLabel ? (
                    <Badge
                      tone="primary"
                      size="sm"
                      className="font-bold"
                      role="status"
                      aria-atomic="true"
                    >
                      {newBadgeLabel}
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 text-xs"
                      role="status"
                      aria-atomic="true"
                      aria-label={`${unreadCount} unread notifications`}
                    >
                      {unreadCount}
                    </Badge>
                  ))}
              </div>
            </div>
            {children ? (
              children
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <EmptyState title={emptyText} compact className="py-6" />
                ) : (
                  notifications.map((notification) => (
                    <Button
                      key={notification.id}
                      type="button"
                      variant="ghost"
                      onClick={() => handleItemClick(notification)}
                      className={cn(
                        "w-full min-h-11 h-auto text-start justify-start border-b border-border/50 px-4 py-3 rounded-none last:border-0 hover:bg-muted/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset block whitespace-normal",
                        !notification.read && "bg-primary/5",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            notification.read
                              ? "bg-muted-foreground/30"
                              : notification.urgent
                                ? "bg-destructive animate-pulse"
                                : "bg-primary",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground truncate">
                            {notification.title}
                          </p>
                          {notification.desc && (
                            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                              {notification.desc}
                            </p>
                          )}
                          {notification.time && (
                            <p className="mt-1 text-2xs font-mono text-muted-foreground">
                              {notification.time}
                            </p>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))
                )}
              </div>
            )}
            {viewAllLabel && onViewAll && (
              <div className="border-t border-border px-4 py-2.5">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setPopoverOpen(false);
                    onViewAll();
                  }}
                  className="text-xs font-bold text-primary hover:underline min-h-11 p-0 cursor-pointer w-full justify-center"
                >
                  {viewAllLabel}
                </Button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
