import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserCheck } from "lucide-react";
import { ModulePageShell } from "@/components/ui/ModulePageShell";
import { ResponsiveAccordionTabs } from "@/components/ui/ResponsiveAccordionTabs";
import { AttendanceCommandMetrics } from "@/tenant/features/attendance/components/AttendanceCommandMetrics";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { attendanceTransferSchema } from "@mms/shared";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { AttendanceWorkTier } from "@/tenant/features/attendance/components/AttendanceWorkTier";
import { AttendanceCsvImportDialog } from "@/tenant/features/attendance/components/AttendanceCsvImportDialog";
import { AttendancePageHeaderActions } from "@/tenant/features/attendance/components/AttendancePageHeaderActions";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAttendancePageController } from "@/tenant/features/attendance/hooks/useAttendancePageController";

const AttendanceReportsTier = React.lazy(() =>
  import("@/tenant/features/attendance/components/AttendanceReportsTier").then((m) => ({
    default: m.AttendanceReportsTier,
  })),
);
const AttendanceSetupTier = React.lazy(() =>
  import("@/tenant/features/attendance/components/AttendanceSetupTier").then((m) => ({
    default: m.AttendanceSetupTier,
  })),
);

const MessageComposer = React.lazy(
  () => import("@/tenant/components/messaging/TenantMessageComposer"),
);

export default function Attendance() {
  const c = useAttendancePageController();
  const [importOpen, setImportOpen] = React.useState(false);
  const { handleExport, isExporting } = useGenericModuleExport({
    path: "/api/attendance/export/csv",
    filename: "attendance.csv",
    auditPath: "/api/attendance/export-audit",
    columns: attendanceTransferSchema.exportColumns,
    canExport: c.canWriteAttendance,
  });

  const renderContent = () => {
    if (!c.effectiveTab) return null;
    if (c.effectiveTab === "setup") {
      return (
        <React.Suspense fallback={<RouteStatusFallback />}>
          <AttendanceSetupTier />
        </React.Suspense>
      );
    }

    if (c.effectiveTab === "reports") {
      return (
        <React.Suspense fallback={<RouteStatusFallback />}>
          <AttendanceReportsTier
            role={c.role}
            filters={c.filters}
            analyticsTabs={c.visibleAnalyticsTabs}
            activeAnalyticsTab={c.effectiveAnalyticsTab}
            onAnalyticsTabChange={c.setActiveAnalyticsTab}
          />
        </React.Suspense>
      );
    }

    return (
      <div className="space-y-5">
        <AttendanceWorkTier
          filters={c.filters}
          role={c.role}
          activeRecords={c.activeAttendanceRecords}
          activeOpsTab={c.effectiveOpsTab}
          operationsTabs={c.visibleOperationsTabs}
          showDeleted={c.showDeleted}
          canDeleteAttendance={c.canDeleteAttendance}
          showRoleBanner={!c.can("users.manage")}
          roleLabel={c.t("attendance.roleBanner.label", { role: c.role })}
          teacherRoleText={
            c.can("attendance.write") &&
            !c.can("finance.write") &&
            c.t("attendance.roleBanner.teacher")
          }
          accountantRoleText={
            c.can("finance.write") &&
            !c.can("attendance.write") &&
            c.t("attendance.roleBanner.accountant")
          }
          showActiveLabel={c.t("attendance.showActive")}
          showDeletedLabel={c.t("attendance.showDeleted")}
          onFiltersChange={c.setFilters}
          onOpsTabChange={c.setActiveOpsTab}
          onShowDeletedToggle={() => c.setShowDeleted((current) => !current)}
          onPersistRecords={c.persistRecords}
          onUpdateRecord={c.handleUpdateRecord}
          onDeleteRecord={c.handleDeleteRecord}
          onRestoreRecord={c.handleRestoreRecord}
          onBulkDeleteRecords={c.handleBulkDeleteRecords}
          onBulkRestoreRecords={c.handleBulkRestoreRecords}
          onMessage={c.handleMessageAttendance}
          onTotalChange={c.setShownCount}
          columnProps={{
            isColumnVisible: c.columnLayout.isColumnVisible,
            getColumnWidth: c.columnLayout.getColumnWidth,
            onColumnResize: c.columnLayout.setColumnWidth,
            columnCustomizer: {
              columnRegistry: c.columnLayout.columnRegistry,
              updateUserColumnLayout: c.columnLayout.updateUserColumnLayout,
              onResetLayout: c.columnLayout.resetColumnLayout,
              labels: c.columnLayout.customizerLabels,
            },
          }}
        />
      </div>
    );
  };

  return (
    <ModulePageShell
      seoTitle={`MMS - ${c.t("nav.attendance")}`}
      seoDescription={c.t("page.attendance.subtitle")}
      headerIcon={UserCheck}
      headerTitle={c.t("nav.attendance")}
      headerSubtitle={c.t("page.attendance.subtitle")}
      headerActions={
        <AttendancePageHeaderActions
          canWrite={c.canWriteAttendance}
          canExport={c.canWriteAttendance}
          showDeleted={c.showDeleted}
          isExporting={isExporting}
          onMarkAttendance={() => {
            c.setActiveTab("work");
            c.setActiveOpsTab("mark");
          }}
          onImport={() => setImportOpen(true)}
          onExport={handleExport}
        />
      }
      metricsStrip={
        <AttendanceCommandMetrics
          total={c.shownCount}
          shown={c.shownCount}
          selectedDate={c.filters.date}
        />
      }
    >
      <ResponsiveAccordionTabs
        tabs={c.visibleTopTabs}
        activeTab={c.effectiveTab}
        onTabChange={c.setActiveTab}
        hideWhenSingle
        panelIdPrefix="attendance-tab"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={c.effectiveTab + "-" + c.effectiveOpsTab + "-" + c.role}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ErrorBoundary>
              {c.attendanceCollectionQuery.isError ? (
                <ErrorState
                  title={c.t("attendance.toast.loadFailed")}
                  description={c.t("attendance.loadFailedHint")}
                  onRetry={() => {
                    void c.attendanceCollectionQuery.refetch();
                  }}
                />
              ) : (
                renderContent()
              )}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      {c.messagingTarget && (
        <React.Suspense fallback={null}>
          <MessageComposer
            channel={c.messagingTarget.channel}
            recipients={c.messagingTarget.recipients}
            onClose={c.closeComposer}
          />
        </React.Suspense>
      )}

      <AttendanceCsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        canWrite={c.canWriteAttendance}
      />
    </ModulePageShell>
  );
}
