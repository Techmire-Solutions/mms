import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SidebarNavItem } from "@/components/app/SidebarNavItem";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/routing/routePrefetch";

export interface AppNavLink {
  id: string;
  /** Already-resolved label text (host adapters own terminology / i18n). */
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  active: boolean;
  /** Optional click handler (e.g. close the mobile drawer). */
  onNavigate?: () => void;
}

export interface AppNavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  open: boolean;
  items: AppNavLink[];
}

export type AppNavEntry =
  { kind: "link"; link: AppNavLink } | { kind: "group"; group: AppNavGroup };

export interface AppNavSection {
  id: string;
  /** Optional section header (platform). Omit for a flat list (tenant). */
  label?: string;
  entries: AppNavEntry[];
}

export interface AppSidebarNavProps {
  sections: AppNavSection[];
  collapsed: boolean;
  isMobile?: boolean;
  reducedMotion?: boolean;
  /** Wrap collapsed desktop links in a label tooltip (platform icon rail). */
  collapsedTooltips?: boolean;
  dir?: "ltr" | "rtl";
  /** Active-rail `layoutId` (per host so rails never collide). */
  layoutId: string;
  centerIconWhenCollapsed?: boolean;
  activeShadow?: boolean;
  onToggleGroup?: (groupId: string) => void;
  navClassName?: string;
  navAriaLabel?: string;
}

/**
 * Shared sidebar navigation renderer for both hosts.
 *
 * Hosts supply a normalized `AppNavSection[]` (links and/or expandable groups) via a
 * thin adapter — tenant derives it from `NAV_ITEMS`, platform from its sectioned
 * registry — while route items still render through the shared `SidebarNavItem`.
 * Keeps the tenant's expandable sub-menu and the platform's sectioned icon-rail
 * behaviour in one place.
 */
export function AppSidebarNav({
  sections,
  collapsed,
  isMobile = false,
  reducedMotion = false,
  collapsedTooltips = false,
  dir = "ltr",
  layoutId,
  centerIconWhenCollapsed = false,
  activeShadow = false,
  onToggleGroup,
  navClassName,
  navAriaLabel,
}: AppSidebarNavProps): React.JSX.Element {
  const renderSubLink = (sub: AppNavLink): React.JSX.Element => {
    const SubIcon = sub.icon;
    return (
      <Link
        key={sub.id}
        to={sub.path}
        onMouseEnter={() => prefetchRoute(sub.path)}
        onFocus={() => prefetchRoute(sub.path)}
        onClick={sub.onNavigate}
        aria-current={sub.active ? "page" : undefined}
        className={`group flex min-h-11 items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 relative ${
          sub.active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
            : "text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        }`}
      >
        {sub.active && (
          <motion.div
            layoutId={reducedMotion ? undefined : `${layoutId}-sub`}
            className="absolute start-0 top-1/2 h-3 w-0.75 -translate-x-full -translate-y-1/2 rounded-e-full bg-sidebar-primary rtl:translate-x-full"
            transition={reducedMotion ? undefined : { type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
        <SubIcon
          className={`w-4 h-4 flex-shrink-0 ${sub.active ? "text-sidebar-primary" : ""}`}
          aria-hidden
        />
        <span className="text-sm font-medium">{sub.label}</span>
      </Link>
    );
  };

  const renderGroup = (group: AppNavGroup): React.JSX.Element => {
    const Icon = group.icon;
    return (
      <div key={group.id} className="space-y-1">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onToggleGroup?.(group.id)}
          className={`group flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-200 hover:bg-sidebar-accent/50 ${
            group.active
              ? "bg-sidebar-accent/35 text-sidebar-foreground"
              : "text-sidebar-muted-foreground hover:text-sidebar-foreground"
          }`}
        >
          <div className="flex items-center gap-3">
            <Icon
              className={`h-4.5 w-4.5 flex-shrink-0 ${group.active ? "text-sidebar-primary" : ""}`}
              aria-hidden
            />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-sm font-medium overflow-hidden whitespace-nowrap"
                >
                  {group.label}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {!collapsed && (
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                group.open
                  ? "rotate-90 text-sidebar-foreground"
                  : "rtl:rotate-180 text-sidebar-muted-foreground group-hover:text-sidebar-foreground"
              }`}
              aria-hidden="true"
            />
          )}
        </Button>

        <AnimatePresence initial={false}>
          {group.open && !collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden space-y-1 border-s border-sidebar-border/40 ps-7 ms-5"
            >
              {group.items.map(renderSubLink)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderLink = (link: AppNavLink): React.JSX.Element => {
    const showLabel = isMobile || !collapsed;
    const node = (
      <SidebarNavItem
        key={link.id}
        to={link.path}
        label={link.label}
        icon={link.icon}
        active={link.active}
        showLabel={showLabel}
        collapsed={collapsed}
        reducedMotion={reducedMotion}
        layoutId={layoutId}
        centerIconWhenCollapsed={centerIconWhenCollapsed}
        activeShadow={activeShadow}
        onClick={link.onNavigate}
      />
    );

    if (collapsedTooltips && !isMobile && collapsed) {
      return (
        <Tooltip key={link.id}>
          <TooltipTrigger asChild>{node}</TooltipTrigger>
          <TooltipContent
            side={dir === "rtl" ? "left" : "right"}
            sideOffset={12}
            className="font-semibold text-xs bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border shadow-md"
          >
            {link.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return node;
  };

  return (
    <nav className={navClassName} aria-label={navAriaLabel}>
      {sections.map((section, sIndex) => {
        const showHeader = Boolean(section.label) && (!collapsed || isMobile);
        const entries = section.entries.map((entry) =>
          entry.kind === "group" ? renderGroup(entry.group) : renderLink(entry.link),
        );

        // Unlabeled single-section hosts (tenant) render entries directly so the nav's
        // own spacing applies; labeled hosts (platform) get per-section grouping.
        if (!section.label) {
          return <React.Fragment key={section.id}>{entries}</React.Fragment>;
        }

        return (
          <div key={section.id} className="space-y-1">
            {showHeader ? (
              <div
                className={cn(
                  "px-3 pb-1 text-2xs uppercase tracking-wider font-mono text-sidebar-muted-foreground/80 font-bold",
                  sIndex > 0 ? "pt-2" : "",
                )}
              >
                {section.label}
              </div>
            ) : null}
            {entries}
          </div>
        );
      })}
    </nav>
  );
}
