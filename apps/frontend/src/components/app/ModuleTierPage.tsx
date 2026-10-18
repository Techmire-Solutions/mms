import React, { Suspense, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import type { AppTranslationKey } from "@mms/shared";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import {
  ResponsiveAccordionTabs,
  type AccordionTabItem,
} from "@/components/app/ResponsiveAccordionTabs";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { useTranslation } from "@/hooks/useTranslation";

export interface ModuleTierPageSpec {
  /** `<title>` translation key; used when `seoTitle` is not set. */
  seoTitleKey?: AppTranslationKey;
  /** Explicit `<title>` override (e.g. legacy `MMS - …` titles). */
  seoTitle?: string;
  /** `<meta description>` and the header subtitle. */
  subtitleKey: AppTranslationKey;
  /** Product header title key (`nav.*`); used when `headerTitle` is not set. */
  headerTitleKey?: AppTranslationKey;
  /** Explicit header title override (e.g. dynamic terminology labels). */
  headerTitle?: string;
  headerIcon?: LucideIcon;
  panelIdPrefix: string;
}

export interface ModuleTierPageTier {
  /** Tab id this tier renders for (must match an item in `tabs`). */
  id: string;
  content: ReactNode;
  /** Wrap in the Suspense + ErrorBoundary gate (lazily-imported tiers). */
  lazy?: boolean;
}

export interface ModuleTierPageProps {
  spec: ModuleTierPageSpec;
  /** Tier tabs from `useFilteredModuleTierTabs` (already permission-filtered). */
  tabs: readonly AccordionTabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  headerActions?: ReactNode;
  metrics?: ReactNode;
  /** Optional content above the tab strip (data banners, conflict panels). */
  banner?: ReactNode;
  /** Tier bodies keyed by tab id — one per visible tab. */
  tiers: readonly ModuleTierPageTier[];
  /** Form/dialog overlays rendered outside the tab flow. */
  overlays?: ReactNode;
}

/** Suspense + error gate for a lazily-imported tier. */
function LazyTier({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteStatusFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

/**
 * Config-driven module page shell. Owns the invariant skeleton — SEO, header,
 * metrics, tab switching, lazy-tier Suspense gates, overlay outlet — so feature
 * pages only supply the tier bodies. Tier ids are not fixed to work/reports/setup,
 * so modules with peer tabs (e.g. faculty `designations`) use the same scaffold.
 */
export function ModuleTierPage({
  spec,
  tabs,
  activeTab,
  onTabChange,
  headerActions,
  metrics,
  banner,
  tiers,
  overlays,
}: ModuleTierPageProps): React.JSX.Element {
  const { t } = useTranslation();
  const subtitle = t(spec.subtitleKey);
  const seoTitle = spec.seoTitle ?? (spec.seoTitleKey ? t(spec.seoTitleKey) : "");
  const headerTitle = spec.headerTitle ?? (spec.headerTitleKey ? t(spec.headerTitleKey) : "");
  const activeTier = tiers.find((tier) => tier.id === activeTab);

  return (
    <ModulePageShell
      seoTitle={seoTitle}
      seoDescription={subtitle}
      headerIcon={spec.headerIcon}
      headerTitle={headerTitle}
      headerSubtitle={subtitle}
      headerActions={headerActions}
      metricsStrip={metrics}
    >
      {banner}

      <ResponsiveAccordionTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        panelIdPrefix={spec.panelIdPrefix}
      >
        <AnimatePresence mode="wait">
          {activeTier ? (
            activeTier.lazy ? (
              <LazyTier>{activeTier.content}</LazyTier>
            ) : (
              <div className="space-y-5">{activeTier.content}</div>
            )
          ) : null}
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      {overlays}
    </ModulePageShell>
  );
}
