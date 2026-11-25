import React from "react";

import { cn } from "../utils";

export interface AppPageShellProps {
  /** Optional error boundary supplied by the app (keeps the package free of app error reporting). */
  ErrorBoundaryComponent?: React.ComponentType<{ children: React.ReactNode }>;
  seoTitle?: string;
  seoDescription?: string;
  headerSlot?: React.ReactNode;
  metricsSlot?: React.ReactNode;
  tabsSlot?: React.ReactNode;
  /**
   * Drawer/sheet outlet — rendered outside the main content flow so slide-over
   * panels do not affect document flow or ARIA tree of the content region.
   */
  drawerOutlet?: React.ReactNode;
  /**
   * When `true`, sets `aria-busy="true"` on the content wrapper to signal to
   * assistive technology that content is loading.
   */
  isBusy?: boolean;
  className?: string;
  children: React.ReactNode;
}

function DefaultBoundary({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}

/**
 * Universal layout primitive shared across platform console and tenant modules.
 * Standardizes SEO metadata tags, container constraints, error boundary,
 * busy state, and drawer portal outlets.
 */
export function AppPageShell({
  ErrorBoundaryComponent = DefaultBoundary,
  seoTitle,
  seoDescription,
  headerSlot,
  metricsSlot,
  tabsSlot,
  drawerOutlet,
  isBusy,
  className,
  children,
}: AppPageShellProps): React.JSX.Element {
  return (
    <ErrorBoundaryComponent>
      <div
        className={cn(
          "box-border mx-auto w-full min-w-0 max-w-7xl space-y-8 sm:space-y-10",
          className,
        )}
        aria-busy={isBusy === true ? "true" : undefined}
      >
        {seoTitle ? <title>{seoTitle}</title> : null}
        {seoDescription ? <meta name="description" content={seoDescription} /> : null}
        {headerSlot && metricsSlot ? (
          // Header and KPI strip read as one command centre: a tight inner gap,
          // with the shell's larger rhythm only between that group and the tiers.
          <div className="space-y-4 sm:space-y-5">
            {headerSlot}
            {metricsSlot}
          </div>
        ) : (
          <>
            {headerSlot}
            {metricsSlot}
          </>
        )}
        {tabsSlot}
        {children}
      </div>
      {drawerOutlet}
    </ErrorBoundaryComponent>
  );
}
