import React, { createContext, useContext } from "react";
import { useNavigationState, type NavigationState } from "@/hooks/useNavigationState";

const STORAGE_KEY = "mms_platform_sidebar_collapsed";

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // Storage can be unavailable in private mode.
  }
}

const PlatformSidebarContext = createContext<NavigationState | null>(null);

export function PlatformSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const navigation = useNavigationState({
    initialCollapsed: getInitialCollapsed,
    onCollapsedChange: persistCollapsed,
  });

  return (
    <PlatformSidebarContext.Provider value={navigation}>{children}</PlatformSidebarContext.Provider>
  );
}

export function usePlatformSidebar(): NavigationState {
  const context = useContext(PlatformSidebarContext);
  if (!context) {
    // Graceful fallback for non-provider renders in unit tests
    return {
      mobileOpen: false,
      setMobileOpen: () => {},
      openMobileSidebar: () => {},
      closeMobileSidebar: () => {},
      collapsed: false,
      setCollapsed: () => {},
      toggleCollapsed: () => {},
      openCommandPalette: () => {},
      closeCommandPalette: () => {},
      toggleCommandPalette: () => {},
      setCommandPaletteOpen: () => {},
      commandPaletteOpen: false,
    };
  }
  return context;
}
