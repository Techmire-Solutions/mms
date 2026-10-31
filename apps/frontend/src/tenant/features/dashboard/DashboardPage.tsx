import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Printer } from "lucide-react";
import { StatisticsGrid } from "@/tenant/features/dashboard/components/StatisticsGrid";
import { DashboardRolePanel } from "@/tenant/features/dashboard/components/DashboardRolePanel";
import { DashboardCustomizePanel } from "@/tenant/features/dashboard/components/DashboardCustomizePanel";
import { WelcomeBanner } from "@/tenant/features/dashboard/components/WelcomeBanner";
import { SetupIncompleteCallout } from "@/tenant/features/dashboard/components/SetupIncompleteCallout";
import { DashboardWidgets } from "@/tenant/features/reports/components/pinnedWidgets/DashboardWidgets";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { Button } from "@/components/ui/button";
import { useDashboardPageController } from "@/tenant/features/dashboard/hooks/useDashboardPageController";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MEDIA_LG_UP } from "@/lib/breakpoints";
import { splitDashboardWidgets } from "@/lib/reports/dashboardWidgetLayout";

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
    gridMode,
    lowAttendanceThreshold,
    urgentAttendanceThreshold,
    handleUpdateThreshold,
    handleUpdateGridMode,
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
  } = useDashboardPageController();

  const branding = useBranding();
  const isAdmin = can("settings.branding.write");
  const isDesktop = useMediaQuery(MEDIA_LG_UP);
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const mobileMetricLimit = 4;
  const { primary: primaryWidgets, secondary: secondaryWidgets } =
    splitDashboardWidgets(visiblePinnedWidgets);
  const metricCards =
    isDesktop || showAllMetrics
      ? visibleDashboardMetricCards
      : visibleDashboardMetricCards.slice(0, mobileMetricLimit);

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
              onClick={() => window.print()}
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
        {canCustomize && isEditMode && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="overflow-hidden mb-2"
          >
            <DashboardCustomizePanel
              can={can}
              customWidgets={customWidgets}
              disabledCardIds={disabledCardIds}
              gridMode={gridMode}
              lowAttendanceThreshold={lowAttendanceThreshold}
              urgentAttendanceThreshold={urgentAttendanceThreshold}
              onUpdateThreshold={handleUpdateThreshold}
              onUpdateGridMode={handleUpdateGridMode}
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
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={`metric-cards-${dashboardRole}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <ErrorBoundary>
            <StatisticsGrid
              statItems={metricCards}
              customCardIds={activeCustomCardIds}
              onDeleteCustomCard={handleDeleteWidget}
              onEditCustomCard={handleEditCustomCard}
              isEditMode={isEditMode}
              onAddCardClick={isEditMode ? () => openWidgetBuilder("card", null) : undefined}
              isLoading={isLoading}
              onResetCards={handleResetCards}
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
        </motion.div>
      </AnimatePresence>

      <ErrorBoundary>
        <DashboardWidgets
          widgets={primaryWidgets}
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
        <motion.div
          key={`body-${dashboardRole}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <ErrorBoundary>
            <DashboardRolePanel dashboardRole={dashboardRole} notifications={notifications} />
          </ErrorBoundary>
        </motion.div>
      </AnimatePresence>
    </ModulePageShell>
  );
}

export default DashboardPage;
