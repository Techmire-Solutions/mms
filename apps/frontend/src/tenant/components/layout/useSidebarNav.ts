import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { NAV_ITEMS } from "@/lib/config/navConfig";
import { filterSidebarNavItems } from "@/lib/config/navAccess";
import { isNavPathActive } from "@/lib/config/routes";
import { useModuleAccess } from "@/tenant/hooks/useModuleAccess";

export function useSidebarNav(collapsed: boolean, onToggle: () => void) {
  const location = useLocation();
  const { evaluate } = useModuleAccess();

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    NAV_ITEMS.forEach((item) => {
      if (
        item.subItems &&
        item.subItems.some((sub) => isNavPathActive(location.pathname, sub.path))
      ) {
        initial[item.labelKey] = true;
      }
    });
    return initial;
  });

  const toggleMenu = (labelKey: string) => {
    if (collapsed) {
      onToggle();
      setOpenMenus((prev) => ({ ...prev, [labelKey]: true }));
    } else {
      setOpenMenus((prev) => ({ ...prev, [labelKey]: !prev[labelKey] }));
    }
  };

  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (
        item.subItems &&
        item.subItems.some((sub) => isNavPathActive(location.pathname, sub.path))
      ) {
        setOpenMenus((prev) => ({ ...prev, [item.labelKey]: true }));
      }
    });
  }, [location.pathname]);

  const visibleMenuItems = filterSidebarNavItems(NAV_ITEMS, evaluate);

  return {
    location,
    openMenus,
    toggleMenu,
    visibleMenuItems,
  };
}
