import { useCallback, useEffect, useState } from "react";

interface NavigationStateOptions {
  initialCollapsed?: boolean | (() => boolean);
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function useNavigationState({
  initialCollapsed = false,
  onCollapsedChange,
}: NavigationStateOptions = {}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  const openMobileSidebar = useCallback(() => setMobileOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);
  const toggleCollapsed = useCallback(() => setCollapsed((previous) => !previous), []);
  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);
  const toggleCommandPalette = useCallback(
    () => setCommandPaletteOpen((previous) => !previous),
    [],
  );

  return {
    mobileOpen,
    setMobileOpen,
    openMobileSidebar,
    closeMobileSidebar,
    collapsed,
    setCollapsed,
    toggleCollapsed,
    commandPaletteOpen,
    setCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette,
  };
}

export type NavigationState = ReturnType<typeof useNavigationState>;
