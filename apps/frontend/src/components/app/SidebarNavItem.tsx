import React from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/routing/routePrefetch";

export interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  /** Whether the label should be visible (e.g. expanded, or always on mobile). */
  showLabel: boolean;
  collapsed: boolean;
  reducedMotion?: boolean;
  /** Active-rail `layoutId`. Omit to hide the rail (e.g. when reduced motion). */
  layoutId?: string;
  onClick?: () => void;
  /** Center the icon when the label is hidden (collapsed rail). Default false. */
  centerIconWhenCollapsed?: boolean;
  /** Add a subtle shadow to the active item. Default false. */
  activeShadow?: boolean;
}

/**
 * Shared sidebar nav link used by both the tenant `SidebarNav` and the platform
 * `PlatformSidebarNav` so route items render identically (active rail, collapsed
 * label animation, route prefetch, sidebar-accent styling) from one source.
 */
export function SidebarNavItem({
  to,
  label,
  icon: Icon,
  active,
  showLabel,
  collapsed: _collapsed,
  reducedMotion = false,
  layoutId,
  onClick,
  centerIconWhenCollapsed = false,
  activeShadow = false,
}: SidebarNavItemProps): React.JSX.Element {
  const centerIcon = centerIconWhenCollapsed && !showLabel;

  return (
    <Link
      to={to}
      onMouseEnter={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={showLabel ? undefined : label}
      className={cn(
        "group flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative select-none cursor-pointer",
        active
          ? cn(
              "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
              activeShadow && "shadow-xs",
            )
          : "text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
        centerIcon && "justify-center px-0 min-w-11",
      )}
    >
      {active && layoutId ? (
        <motion.div
          layoutId={reducedMotion ? undefined : layoutId}
          className="absolute start-0 top-1/2 -translate-y-1/2 w-0.75 h-5 bg-sidebar-primary rounded-e-full"
          transition={reducedMotion ? undefined : { type: "spring", stiffness: 300, damping: 30 }}
        />
      ) : null}
      <Icon
        className={cn(
          "h-4.5 w-4.5 shrink-0 transition-colors",
          active ? "text-sidebar-primary" : "",
        )}
        aria-hidden
      />
      <AnimatePresence>
        {showLabel ? (
          <motion.span
            initial={reducedMotion ? false : { opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={reducedMotion ? undefined : { opacity: 0, width: 0 }}
            className="text-sm font-medium overflow-hidden whitespace-nowrap"
          >
            {label}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </Link>
  );
}
