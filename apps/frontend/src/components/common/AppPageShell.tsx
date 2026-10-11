import React from "react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { cn } from "@/lib/utils";

export interface AppPageShellProps {
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

/**
 * Universal layout primitive shared across platform console and tenant modules.
 * Standardizes SEO metadata tags, container constraints, error boundary,
 * busy state, and drawer portal outlets.
 */
export function AppPageShell({
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
    <ErrorBoundary>
      <div
        className={cn(
          "box-border mx-auto w-full min-w-0 max-w-7xl space-y-8 sm:space-y-10",
          className,
        )}
        aria-busy={isBusy === true ? "true" : undefined}
      >
        {seoTitle ? <title>{seoTitle}</title> : null}
        {seoDescription ? <meta name="description" content={seoDescription} /> : null}
        {headerSlot}
        {metricsSlot}
        {tabsSlot}
        {children}
      </div>
      {drawerOutlet}
    </ErrorBoundary>
  );
}
