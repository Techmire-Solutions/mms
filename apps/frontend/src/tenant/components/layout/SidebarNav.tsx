import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SidebarNavItem } from "@/components/app/SidebarNavItem";
import { useTranslation } from "@/hooks/useTranslation";
import { isNavPathActive, ROUTES } from "@/lib/config/routes";
import { prefetchRoute } from "@/lib/routing/routePrefetch";
import type { NavItem } from "@/lib/config/navConfig";
import { useIndustryTerminology } from "@/tenant/hooks/useIndustryTerminology";

interface SidebarNavProps {
  collapsed: boolean;
  locationPathname: string;
  visibleMenuItems: NavItem[];
  openMenus: Record<string, boolean>;
  onToggleMenu: (labelKey: string) => void;
}

export function SidebarNav({
  collapsed,
  locationPathname,
  visibleMenuItems,
  openMenus,
  onToggleMenu,
}: SidebarNavProps): React.JSX.Element {
  const { t } = useTranslation();
  const terminology = useIndustryTerminology();

  function resolveNavLabel(labelKey: NavItem["labelKey"]): string {
    if (labelKey === "nav.faculty") return terminology.facultyLabel;
    if (labelKey === "nav.students") return terminology.studentLabel;
    // Nav keys are parameter-free; cast avoids union-with-params overload of `t`.
    return t(labelKey as "nav.dashboard");
  }

  return (
    <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
      {visibleMenuItems.map((item) => {
        if (item.subItems) {
          const isMenuOpen = !!openMenus[item.labelKey];
          const hasActiveSub = item.subItems.some((sub) =>
            isNavPathActive(locationPathname, sub.path),
          );
          const Icon = item.icon;

          return (
            <div key={item.labelKey} className="space-y-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onToggleMenu(item.labelKey)}
                className={`group flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-200 hover:bg-sidebar-accent/50 ${
                  hasActiveSub
                    ? "bg-sidebar-accent/35 text-sidebar-foreground"
                    : "text-sidebar-muted-foreground hover:text-sidebar-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4.5 w-4.5 flex-shrink-0 ${hasActiveSub ? "text-sidebar-primary" : ""}`}
                  />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className="text-sm font-medium overflow-hidden whitespace-nowrap"
                      >
                        {resolveNavLabel(item.labelKey)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                {!collapsed && (
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform duration-200 rtl:rotate-180 ${
                      isMenuOpen
                        ? "rotate-90 rtl:-rotate-90 text-sidebar-foreground"
                        : "text-sidebar-muted-foreground group-hover:text-sidebar-foreground"
                    }`}
                  />
                )}
              </Button>

              <AnimatePresence initial={false}>
                {isMenuOpen && !collapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden space-y-1 border-s border-sidebar-border/40 ps-7 ms-5"
                  >
                    {item.subItems.map((sub) => {
                      const isSubActive = isNavPathActive(locationPathname, sub.path);
                      const SubIcon = sub.icon;

                      return (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          onMouseEnter={() => prefetchRoute(sub.path)}
                          onFocus={() => prefetchRoute(sub.path)}
                          className={`group flex min-h-11 items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 relative ${
                            isSubActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                              : "text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                          }`}
                        >
                          {isSubActive && (
                            <motion.div
                              layoutId="sidebar-indicator-sub"
                              className="absolute start-0 top-1/2 h-3 w-0.75 -translate-x-full -translate-y-1/2 rounded-e-full bg-sidebar-primary rtl:translate-x-full"
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          )}
                          <SubIcon
                            className={`w-4 h-4 flex-shrink-0 ${isSubActive ? "text-sidebar-primary" : ""}`}
                          />
                          <span className="text-sm font-medium">
                            {resolveNavLabel(sub.labelKey)}
                          </span>
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        }

        const isActive = isNavPathActive(locationPathname, item.path ?? ROUTES.home);

        return (
          <SidebarNavItem
            key={item.path || item.labelKey}
            to={item.path!}
            label={resolveNavLabel(item.labelKey)}
            icon={item.icon}
            active={isActive}
            showLabel={!collapsed}
            collapsed={collapsed}
            layoutId="sidebar-indicator"
          />
        );
      })}
    </nav>
  );
}
