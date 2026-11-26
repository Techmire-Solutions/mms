import React, { lazy } from "react";
import { AnimatePresence } from "framer-motion";
import { CheckSquare } from "lucide-react";
import { ModulePageShell } from "@mms/fe-core/components/ModulePageShell";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { ResponsiveAccordionTabs } from "@mms/fe-core/components/ResponsiveAccordionTabs";
import RouteStatusFallback from "@mms/fe-core/routing/RouteStatusFallback";
import { TasksWorkTab } from "./TasksWorkTab";
import { TaskFormModal } from "./TaskFormModal";
import { TasksCsvImportDialog } from "./TasksCsvImportDialog";
import { TasksPageHeaderActions } from "./TasksPageHeaderActions";
import { TasksCommandMetrics } from "./TasksCommandMetrics";
import type { TasksPageController } from "../hooks/useTasksPageController";

// Reports pulls Recharts and Setup pulls the settings form; neither belongs in
// the Work-tier chunk (matches the Contacts/Students/Faculty tier contract).
const TasksReportsTab = lazy(() =>
  import("./TasksReportsTab").then((m) => ({
    default: m.TasksReportsTab,
  })),
);
const TasksSetupTab = lazy(() =>
  import("./TasksSetupTab").then((m) => ({
    default: m.TasksSetupTab,
  })),
);

export type TasksPageViewProps = TasksPageController;

/** Presentational Tasks page — Work / Reports / Setup plus the write overlays. */
export function TasksPageView({
  t,
  activeTab,
  setActiveTab,
  pageTabs,
  canRead,
  canWrite,
  canDelete,
  canEditSetup,
  canViewSetup,
  canComplete,
  isSaving,
  statusPending,
  viewingDeleted,
  handleToggleTrash,
  formOpen,
  editingTask,
  handleOpenCreate,
  handleOpenEdit,
  handleCloseForm,
  handleSave,
  importOpen,
  setImportOpen,
  handleExport,
  isExporting,
  tasks,
  totalTasks,
  tasksLoading,
  tasksError,
  handleRetry,
  metrics,
  selectedIds,
  toggleSelected,
  toggleSelectAll,
  clearSelection,
  pageIndex,
  setPageIndex,
  pageSize,
  handleServerFiltersChange,
  handleUpdateStatus,
  handleDelete,
  handleRestore,
}: TasksPageViewProps): React.JSX.Element {
  return (
    <ModulePageShell
      seoTitle={t("page.tasks.seoTitle")}
      seoDescription={t("page.tasks.subtitle")}
      headerIcon={CheckSquare}
      headerTitle={t("nav.tasks")}
      headerSubtitle={t("page.tasks.subtitle")}
      headerActions={
        <TasksPageHeaderActions
          canWrite={canWrite}
          canExport={canRead}
          showDeleted={viewingDeleted}
          isExporting={isExporting}
          onCreate={handleOpenCreate}
          onImport={() => setImportOpen(true)}
          onExport={handleExport}
        />
      }
      metricsStrip={
        viewingDeleted || activeTab !== "work" ? undefined : (
          <TasksCommandMetrics metrics={metrics} shown={totalTasks} />
        )
      }
    >
      <ResponsiveAccordionTabs
        tabs={pageTabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TasksPageViewProps["activeTab"])}
        panelIdPrefix="tasks-tab"
      >
        <AnimatePresence mode="wait">
          <ModuleTierMotion
            tier={activeTab}
            className="space-y-4"
            aria-busy={activeTab === "work" && tasksLoading ? true : undefined}
          >
            {activeTab === "work" && (
              <TasksWorkTab
                tasks={tasks}
                isLoading={tasksLoading}
                isError={tasksError}
                onRetry={handleRetry}
                canWrite={canWrite && !viewingDeleted}
                canComplete={canComplete && !viewingDeleted}
                statusPending={statusPending}
                canDelete={canDelete}
                viewingDeleted={viewingDeleted}
                selectedIds={selectedIds}
                onToggleSelected={toggleSelected}
                onToggleSelectAll={toggleSelectAll}
                onClearSelection={clearSelection}
                onToggleTrash={handleToggleTrash}
                onAddNew={handleOpenCreate}
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
                onRestore={handleRestore}
                onUpdateStatus={handleUpdateStatus}
                total={totalTasks}
                pageIndex={pageIndex}
                pageSize={pageSize}
                onPageChange={setPageIndex}
                onServerFiltersChange={handleServerFiltersChange}
              />
            )}

            {activeTab === "reports" && canRead ? (
              <React.Suspense fallback={<RouteStatusFallback />}>
                <TasksReportsTab />
              </React.Suspense>
            ) : null}

            {activeTab === "setup" && canViewSetup ? (
              <React.Suspense fallback={<RouteStatusFallback />}>
                <TasksSetupTab canEditSetup={canEditSetup} />
              </React.Suspense>
            ) : null}
          </ModuleTierMotion>
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      <TaskFormModal
        open={formOpen}
        onClose={handleCloseForm}
        initialData={editingTask}
        onSave={handleSave}
        saving={isSaving}
      />

      <TasksCsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        canWrite={canWrite}
      />
    </ModulePageShell>
  );
}
