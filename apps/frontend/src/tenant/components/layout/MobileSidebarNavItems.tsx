import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import type { NavItem } from "@/lib/config/navConfig";
import { isNavPathActive, ROUTES } from "@/lib/config/routes";
import { prefetchRoute } from "@/lib/routing/routePrefetch";

interface MobileSidebarNavItemsProps {
  items: NavItem[];
  openMenus: Record<string, boolean>;
  onToggleMenu: (labelKey: string) => void;
  onClose: () => void;
}

export function MobileSidebarNavItems({
  items,
  openMenus,
  onToggleMenu,
  onClose,
}: MobileSidebarNavItemsProps): React.JSX.Element {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <>
      {items.map((item) => {
        if (item.subItems) {
          const isMenuOpen = !!openMenus[item.labelKey];
          const hasActiveSub = item.subItems.some((sub) =>
            isNavPathActive(location.pathname, sub.path),
          );
          const Icon = item.icon;
          const subMenuId = `mobile-subnav-${item.labelKey.replace(/[^a-zA-Z0-9]/g, "-")}`;

          return (
            <div key={item.labelKey} className="space-y-1">
              <Button
                type="button"
                variant="ghost"
                aria-expanded={isMenuOpen}
                aria-controls={subMenuId}
                onClick={() => onToggleMenu(item.labelKey)}
                className={`group flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-200 hover:bg-sidebar-accent/50 active:bg-sidebar-accent/70 touch-manipulation active:scale-tap-subtle select-none ${
                  hasActiveSub
                    ? "bg-sidebar-accent/30 text-sidebar-foreground"
                    : "text-sidebar-muted-foreground hover:text-sidebar-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4.5 w-4.5 flex-shrink-0 ${hasActiveSub ? "text-sidebar-primary" : ""}`}
                  />
                  <span className="text-sm font-medium">{t(item.labelKey)}</span>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isMenuOpen
                      ? "rotate-90 text-sidebar-foreground"
                      : "rtl:rotate-180 text-sidebar-muted-foreground group-hover:text-sidebar-foreground group-active:text-sidebar-foreground"
                  }`}
                  aria-hidden="true"
                />
              </Button>

              <AnimatePresence initial={false}>
                {isMenuOpen && (
                  <motion.div
                    id={subMenuId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden space-y-1 border-s border-sidebar-border/40 ps-7 ms-5"
                  >
                    {item.subItems.map((sub) => {
                      const isSubActive = isNavPathActive(location.pathname, sub.path);
                      const SubIcon = sub.icon;

                      return (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          onClick={onClose}
                          aria-current={isSubActive ? "page" : undefined}
                          onMouseEnter={() => prefetchRoute(sub.path)}
                          onFocus={() => prefetchRoute(sub.path)}
                          className={`group flex min-h-11 items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 touch-manipulation active:scale-tap-subtle select-none relative ${
                            isSubActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                              : "text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 active:bg-sidebar-accent/70"
                          }`}
                        >
                          {isSubActive && (
                            <motion.div
                              layoutId="mobile-sidebar-indicator-sub"
                              className="absolute start-0 top-1/2 h-3 w-0.75 -translate-x-full -translate-y-1/2 rounded-e-full bg-sidebar-primary rtl:translate-x-full"
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          )}
                          <SubIcon
                            className={`w-4 h-4 flex-shrink-0 ${isSubActive ? "text-sidebar-primary" : ""}`}
                          />
                          <span className="text-sm font-medium">{t(sub.labelKey)}</span>
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        }

        const isActive = isNavPathActive(location.pathname, item.path ?? ROUTES.home);
        const Icon = item.icon;
        return (
          <Link
            key={item.path || item.labelKey}
            to={item.path!}
            onClick={onClose}
            aria-current={isActive ? "page" : undefined}
            onMouseEnter={() => prefetchRoute(item.path!)}
            onFocus={() => prefetchRoute(item.path!)}
            className={`group flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 touch-manipulation active:scale-tap-subtle relative select-none ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                : "text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 active:bg-sidebar-accent/70"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="mobile-sidebar-indicator"
                className="absolute start-0 top-1/2 -translate-y-1/2 w-0.75 h-5 bg-sidebar-primary rounded-e-full"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <Icon
              className={`h-4.5 w-4.5 flex-shrink-0 ${isActive ? "text-sidebar-primary" : ""}`}
            />
            <span className="text-sm font-medium">{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </>
  );
}
