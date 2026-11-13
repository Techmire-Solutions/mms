import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface RouteStatusFallbackProps {
  /** Use full viewport height (boot gates) vs in-route Suspense fallback. */
  fullScreen?: boolean;
}

/** Accessible app-shell skeleton loading state for route boot gates and transitions. */
export default function RouteStatusFallback({
  fullScreen = true,
}: RouteStatusFallbackProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className={`bg-background text-foreground ${
        fullScreen ? "min-h-screen w-full flex flex-col" : "w-full"
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{t("common.loading")}</span>

      {/* Mobile-first Header Placeholder matching AppLayout top-bar height (h-14 / 56px) */}
      <header className="flex h-14 w-full items-center justify-between border-b border-border bg-card/80 px-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted/60" aria-hidden="true" />
          <div className="h-6 w-32 rounded-md bg-muted/60" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-muted/60" aria-hidden="true" />
          <div className="h-9 w-9 rounded-lg bg-muted/60" aria-hidden="true" />
        </div>
      </header>

      {/* Main Container rendering Dashboard / Page Scaffold matching final dimensions */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto box-border space-y-6">
        {/* WelcomeBanner / Header Skeleton */}
        <div className="rounded-2xl border border-foreground/10 bg-card p-6 md:p-8 space-y-4">
          <div className="h-4 w-24 rounded bg-primary/20" />
          <div className="h-8 w-64 md:w-96 rounded-md bg-muted/60" />
          <div className="h-4 w-48 rounded bg-muted/40" />
        </div>

        {/* 4 Metric Cards Grid Skeleton matching final 2-col mobile / 4-col desktop layout */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 font-sans">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={`route-fallback-card-${idx}`}
              className="rounded-2xl border border-border/40 bg-card p-5 min-h-32 flex flex-col justify-between"
              aria-hidden="true"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-muted/60" />
                <div className="w-12 h-5 rounded-md bg-muted/40" />
              </div>
              <div className="space-y-2 mt-4">
                <div className="w-20 h-6 rounded bg-muted/60" />
                <div className="w-28 h-3 rounded bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
