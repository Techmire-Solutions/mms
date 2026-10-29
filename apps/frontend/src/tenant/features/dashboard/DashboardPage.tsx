import React from "react";
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

  return (
    <ModulePageShell
      seoTitle={`MMS - ${t("dashboard.title")}`}
      seoDescription={t("dashboard.metaDescription")}
    >
      <WelcomeBanner
        dashboardRole={dashboardRole}
        activeSessionsCount={activeSessionsCount}
        activeStudentCount={studentMetricsActive}
      />

      <SetupIncompleteCallout branding={branding} isAdmin={isAdmin} />

      <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2 select-none print:hidden">
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
      </div>

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
              statItems={visibleDashboardMetricCards}
              customCardIds={activeCustomCardIds}
              onDeleteCustomCard={handleDeleteWidget}
              onEditCustomCard={handleEditCustomCard}
              isEditMode={isEditMode}
              onAddCardClick={isEditMode ? () => openWidgetBuilder("card", null) : undefined}
              isLoading={isLoading}
              onResetCards={handleResetCards}
            />
          </ErrorBoundary>
        </motion.div>
      </AnimatePresence>

      <ErrorBoundary>
        <DashboardWidgets
          widgets={visiblePinnedWidgets}
          onUnpin={handleUnpinWidget}
          isEditMode={isEditMode}
          onEditWidget={handleEditWidget}
          onDeleteWidget={handleDeleteWidget}
        />
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
