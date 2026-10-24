import React from "react";
import { PageHeader, type PageHeaderProps } from "@/components/app/PageHeader";
import {
  ResponsiveAccordionTabs,
  type AccordionTabItem,
} from "@/components/app/ResponsiveAccordionTabs";
import { AppPageShell, type AppPageShellProps } from "@/components/common/AppPageShell";
import {
  AppPageShellSkeleton,
  type AppPageShellSkeletonProps,
} from "@/components/common/AppPageShellSkeleton";

export interface ModuleScaffoldProps {
  seoTitle: string;
  seoDescription: string;
  headerIcon?: PageHeaderProps["icon"];
  headerTitle?: string;
  headerSubtitle?: string;
  headerActions?: PageHeaderProps["actions"];
  metricsStrip?: React.ReactNode;
  tabs?: AccordionTabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  panelIdPrefix?: string;
  className?: string;
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
  children: React.ReactNode;
}

/**
 * Universal 3-tier Module Scaffold layout primitive.
 * Standardizes SEO metadata, PageHeader, metrics strip, 3-tier tab navigation,
 * and responsive container styling. Thin wrapper over {@link AppPageShell}.
 */
export function ModuleScaffold({
  seoTitle,
  seoDescription,
  headerIcon,
  headerTitle,
  headerSubtitle,
  headerActions,
  metricsStrip,
  tabs,
  activeTab,
  onTabChange,
  panelIdPrefix = "module-tab",
  className,
  drawerOutlet,
  isBusy,
  children,
}: ModuleScaffoldProps): React.JSX.Element {
  const headerSlot = headerTitle ? (
    <PageHeader
      icon={headerIcon}
      title={headerTitle}
      subtitle={headerSubtitle}
      actions={headerActions}
    />
  ) : undefined;

  const content =
    tabs && activeTab && onTabChange ? (
      <ResponsiveAccordionTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        panelIdPrefix={panelIdPrefix}
      >
        {children}
      </ResponsiveAccordionTabs>
    ) : (
      children
    );

  return (
    <AppPageShell
      seoTitle={seoTitle}
      seoDescription={seoDescription}
      headerSlot={headerSlot}
      metricsSlot={metricsStrip}
      className={className}
      drawerOutlet={drawerOutlet}
      isBusy={isBusy}
    >
      {content}
    </AppPageShell>
  );
}

export type ModuleScaffoldSkeletonProps = AppPageShellSkeletonProps;
export const ModuleScaffoldSkeleton = AppPageShellSkeleton;
export type { AppPageShellProps };
