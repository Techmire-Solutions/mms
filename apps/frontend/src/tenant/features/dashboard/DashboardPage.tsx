import React from "react";
import { m, AnimatePresence } from "framer-motion";
import { Settings, Printer } from "lucide-react";
import { StatisticsGrid } from "@/tenant/features/dashboard/components/StatisticsGrid";
import { DashboardRolePanel } from "@/tenant/features/dashboard/components/DashboardRolePanel";
import { DashboardCustomizePanel } from "@/tenant/features/dashboard/components/DashboardCustomizePanel";
import { DashboardMetricsAlert } from "@/tenant/features/dashboard/components/DashboardMetricsAlert";
import { WelcomeBanner } from "@/tenant/features/dashboard/components/WelcomeBanner";
import { SetupIncompleteCallout } from "@/tenant/features/dashboard/components/SetupIncompleteCallout";
import { DashboardWidgets } from "@/tenant/components/reports/pinnedWidgetsFacade";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { Button } from "@/components/ui/button";
import { useDashboardPageController } from "@/tenant/features/dashboard/hooks/useDashboardPageController";
import { useDashboardSnapshotPrintState } from "@/tenant/features/dashboard/hooks/useDashboardSnapshotPrintState";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { MEDIA_LG_UP } from "@/lib/breakpoints";
import { splitDashboardWidgets } from "@/lib/reports/dashboardWidgetLayout";
import { selectAggregateWidgets } from "@/lib/dashboardCollections";

export function DashboardPage() {
  const {
    t,
    can,
    dashboardRole,
    canCustomize,
    isEditMode,
    setIsEditMode,
    customWidgets,
    disabledCardIds,
    lowAttendanceThreshold,
    urgentAttendanceThreshold,
    handleUpdateThreshold,
    handleReorderWidgets,
    toggleCardVisibility,
    handleResetCards,
    isLoading,
    isWidgetBuilderOpen,
    editingWidget,
    widgetBuilderType,
    closeBuilder,
    handleSaveWidget,
    handleEditWidget,
    handleEditCustomCard,
    handleDeleteWidget,
    handleUnpinWidget,
    toggleWidgetPin,
    openWidgetBuilder,
    activeCustomCardIds,
    dashboardMetricCards,
    selectedDashboardCardCount,
    visibleDashboardMetricCards,
    visiblePinnedWidgets,
    pinnedDashboardWidgetCount,
    notifications,
    activeSessionsCount,
    studentMetricsActive,
    isConfigReady,
    summaryError,
    retrySummary,
  } = useDashboardPageController();

  const branding = useBranding();
  const isAdmin = can("settings.branding.write");
  const isDesktop = useMediaQuery(MEDIA_LG_UP);
  const reducedMotion = useReducedMotion();
  const { showAllMetrics, showInsights, setShowAllMetrics, setShowInsights, printSnapshot } =
    useDashboardSnapshotPrintState();
  const mobileMetricLimit = 4;
  const { primary: primaryWidgets, secondary: secondaryWidgets } = React.useMemo(
    () => splitDashboardWidgets(visiblePinnedWidgets),
    [visiblePinnedWidgets],
  );
  // One canonical aggregate list shared by every surface, so the content-keyed
  // `/aggregates` queries dedupe instead of firing once per widget group.
  const aggregateWidgets = React.useMemo(
    () => selectAggregateWidgets(customWidgets),
    [customWidgets],
  );
  const metricCards = React.useMemo(
    () =>
      isDesktop || showAllMetrics
        ? visibleDashboardMetricCards
        : visibleDashboardMetricCards.slice(0, mobileMetricLimit),
    [isDesktop, showAllMetrics, visibleDashboardMetricCards],
  );

  return (
    <ModulePageShell
      seoTitle={`MMS - ${t("dashboard.title")}`}
      seoDescription={t("dashboard.metaDescription")}
    >
      <WelcomeBanner
        dashboardRole={dashboardRole}
        activeSessionsCount={activeSessionsCount}
        activeStudentCount={studentMetricsActive}
        actions={
          <>
            <Button
              onClick={printSnapshot}
              variant="capsOutline"
              size="caps"
              className="flex items-center justify-center px-4 py-2 transition-all duration-300 cursor-pointer"
              title={t("dashboard.printSnapshot")}
            >
              <Printer className="w-4 h-4" />
              {t("dashboard.printSnapshot")}
            </Button>
            {canCustomize && (
              <Button
                onClick={() => setIsEditMode(!isEditMode)}
                disabled={!isConfigReady}
                // Customization mutates the stored configuration document; it opens
                // only after both documents loaded, so a save can never be built
                // from the defaults.
                title={isConfigReady ? undefined : t("common.loading")}
                aria-expanded={isEditMode}
                // Only reference the panel while it is mounted.
                aria-controls={isEditMode ? "dashboard-customize-panel" : undefined}
                variant={isEditMode ? "capsPrimary" : "capsOutline"}
                size="caps"
                className={`flex items-center justify-center px-4 py-2 transition-all duration-300 cursor-pointer ${
                  isEditMode ? "shadow-md shadow-primary/20" : ""
                }`}
              >
                <Settings className="w-4 h-4" />
                {isEditMode ? t("dashboard.exitCustomization") : t("dashboard.customizeCards")}
              </Button>
            )}
          </>
        }
      />

      <SetupIncompleteCallout branding={branding} isAdmin={isAdmin} />

      <AnimatePresence>
        {canCustomize && isEditMode && isConfigReady && (
          <m.div
            initial={reducedMotion ? false : { opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, height: 0, y: -20 }}
            transition={reducedMotion ? { duration: 0 } : undefined}
            className="overflow-hidden mb-2 print:hidden"
          >
            <DashboardCustomizePanel
              can={can}
              customWidgets={customWidgets}
              disabledCardIds={disabledCardIds}
              lowAttendanceThreshold={lowAttendanceThreshold}
              urgentAttendanceThreshold={urgentAttendanceThreshold}
              onUpdateThreshold={handleUpdateThreshold}
              toggleCardVisibility={toggleCardVisibility}
              dashboardMetricCards={dashboardMetricCards}
              selectedDashboardCardCount={selectedDashboardCardCount}
              pinnedDashboardWidgetCount={pinnedDashboardWidgetCount}
              isWidgetBuilderOpen={isWidgetBuilderOpen}
              editingWidget={editingWidget}
              widgetBuilderType={widgetBuilderType}
              onCloseBuilder={closeBuilder}
              onSaveWidget={handleSaveWidget}
              onEditWidget={handleEditWidget}
              onDeleteWidget={handleDeleteWidget}
              onToggleWidgetPin={toggleWidgetPin}
              onOpenWidgetBuilder={openWidgetBuilder}
              onReorderWidgets={handleReorderWidgets}
              onDone={() => setIsEditMode(false)}
            />
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <m.div
          key={`metric-cards-${dashboardRole}`}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.25 }}
        >
          {summaryError ? (
            <DashboardMetricsAlert
              message={t("dashboard.metricsUnavailable")}
              retryLabel={t("common.retry")}
              onRetry={retrySummary}
            />
          ) : null}
          <ErrorBoundary>
            <StatisticsGrid
              statItems={metricCards}
              customCardIds={activeCustomCardIds}
              onDeleteCustomCard={handleDeleteWidget}
              onEditCustomCard={handleEditCustomCard}
              isEditMode={isEditMode}
              onAddCardClick={isEditMode ? () => openWidgetBuilder("card", null) : undefined}
              isLoading={isLoading}
              // Restoring the default cards is a write: viewers must not see an
              // action that would silently do nothing.
              onResetCards={canCustomize ? handleResetCards : undefined}
            />
          </ErrorBoundary>
          {!isDesktop && visibleDashboardMetricCards.length > mobileMetricLimit ? (
            <div className="mt-3 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 rounded-xl text-xs"
                aria-expanded={showAllMetrics}
                onClick={() => setShowAllMetrics((current) => !current)}
              >
                {showAllMetrics
                  ? t("dashboard.showFewerMetrics")
                  : t("dashboard.showAllMetrics", {
                      count: visibleDashboardMetricCards.length,
                    })}
              </Button>
            </div>
          ) : null}
        </m.div>
      </AnimatePresence>

      <ErrorBoundary>
        <DashboardWidgets
          widgets={primaryWidgets}
          aggregateWidgets={aggregateWidgets}
          onUnpin={handleUnpinWidget}
          isEditMode={isEditMode}
          onEditWidget={handleEditWidget}
          onDeleteWidget={handleDeleteWidget}
          showHeader={primaryWidgets.length > 0}
        />
        {secondaryWidgets.length > 0 ? (
          // Desktop used to expand every secondary insight by default, which made
          // the dashboard 3,650 px tall with four empty analytics panels. The
          // disclosure is now the same on every viewport (2026-10-31 review, UX-08).
          <div className="mt-4 space-y-3">
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 w-full rounded-xl text-xs sm:w-auto"
                aria-expanded={showInsights}
                onClick={() => setShowInsights((current) => !current)}
              >
                {showInsights
                  ? t("dashboard.hideInsights")
                  : t("dashboard.showInsights", { count: secondaryWidgets.length })}
              </Button>
            </div>
            {showInsights ? (
              <DashboardWidgets
                widgets={secondaryWidgets}
                aggregateWidgets={aggregateWidgets}
                onUnpin={handleUnpinWidget}
                isEditMode={isEditMode}
                onEditWidget={handleEditWidget}
                onDeleteWidget={handleDeleteWidget}
                showHeader={false}
              />
            ) : null}
          </div>
        ) : null}
      </ErrorBoundary>

      <AnimatePresence mode="wait">
        <m.div
          key={`body-${dashboardRole}`}
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}
        >
          <ErrorBoundary>
            <DashboardRolePanel dashboardRole={dashboardRole} notifications={notifications} />
          </ErrorBoundary>
        </m.div>
      </AnimatePresence>
    </ModulePageShell>
  );
}

export default DashboardPage;
