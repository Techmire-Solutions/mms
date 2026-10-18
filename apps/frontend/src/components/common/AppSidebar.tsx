import React from "react";
import { cn } from "@/lib/utils";

export interface AppSidebarProps {
  collapsed: boolean;
  /** Brand / logo block pinned to the top. */
  brand: React.ReactNode;
  /** Optional content rendered between the brand and the nav (e.g. a search trigger). */
  beforeNav?: React.ReactNode;
  /** The navigation region — grow to fill the sidebar (e.g. `flex-1`). */
  children: React.ReactNode;
  /** Footer block pinned to the bottom (account, sign-out, collapse toggle). */
  footer?: React.ReactNode;
}

/**
 * Shared desktop-sidebar frame for both hosts.
 *
 * Owns only the chrome both tenant and platform need in common: the width/collapse
 * container, sidebar surface tokens, the account/route-item border, and the
 * motion-safe collapse transition. Hosts inject their own `brand`, optional
 * `beforeNav`, nav content and `footer` — those differ by host (platform groups by
 * section with tooltips; tenant nests expandable menus) and route items already
 * render via the shared `SidebarNavItem`.
 *
 * Mounted inside `AppShell`'s desktop `<aside>` (fixed, `hidden lg:block`), so this
 * frame fills that column (`h-full`) rather than re-positioning itself.
 */
export function AppSidebar({
  collapsed,
  brand,
  beforeNav,
  children,
  footer,
}: AppSidebarProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "z-sidebar flex h-full flex-col select-none border-e border-sidebar-border bg-sidebar transition-all duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-sidebar-collapsed" : "w-sidebar",
      )}
    >
      {brand}
      {beforeNav}
      {children}
      {footer}
    </div>
  );
}

export default AppSidebar;
