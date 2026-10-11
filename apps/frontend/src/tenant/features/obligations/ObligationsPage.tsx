import React, { Suspense, lazy } from "react";
import { AnimatePresence } from "framer-motion";
import { Scale } from "lucide-react";
import { ModulePageShell } from "@/components/ui/ModulePageShell";
import { ModuleTierMotion } from "@/components/ui/ModuleTierMotion";
import { ResponsiveAccordionTabs } from "@/components/ui/ResponsiveAccordionTabs";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { obligationsTransferSchema } from "@mms/shared";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { ObligationsModalLayer } from "@/tenant/features/obligations/components/ObligationsModalLayer";
import { ObligationsPageActions } from "@/tenant/features/obligations/components/ObligationsPageActions";
import { ObligationsWorkTier } from "@/tenant/features/obligations/components/ObligationsWorkTier";
import { ObligationsCommandMetrics } from "@/tenant/features/obligations/components/ObligationsCommandMetrics";
import { ObligationsCsvImportDialog } from "@/tenant/features/obligations/components/ObligationsCsvImportDialog";
import { useObligationsPageController } from "@/tenant/features/obligations/hooks/useObligationsPageController";

const ObligationsReportsTier = lazy(() =>
  import("@/tenant/features/obligations/components/ObligationsReportsTier").then((m) => ({
    default: m.ObligationsReportsTier,
  })),
);
const ObligationsSetupTier = lazy(() =>
  import("@/tenant/features/obligations/components/ObligationsSetupTier").then((m) => ({
    default: m.ObligationsSetupTier,
  })),
);

/**
 * Obligations — Khums, Zakat, and collections. Work | Reports | Setup.
 */
export default function Obligations() {
  const c = useObligationsPageController();
  const [importOpen, setImportOpen] = React.useState(false);
  const { handleExport, isExporting } = useGenericModuleExport({
    path: "/api/obligations/export/csv",
    filename: "obligations.csv",
    auditPath: "/api/obligations/export-audit",
    columns: obligationsTransferSchema.exportColumns,
    canExport: c.canWrite,
  });

  return (
    <ModulePageShell
      seoTitle={`MMS - ${c.t("nav.obligations")}`}
      seoDescription={c.t("page.obligations.subtitle")}
      headerIcon={Scale}
      headerTitle={c.t("nav.obligations")}
      headerSubtitle={c.t("page.obligations.subtitle")}
      headerActions={
        <ObligationsPageActions
          canWrite={c.canWrite}
          canExport={c.canWrite}
          isExporting={isExporting}
          showDeleted={c.showDeleted}
          onCreate={() => c.setShowForm(true)}
          onImport={() => setImportOpen(true)}
          onExport={handleExport}
        />
      }
      metricsStrip={
        <ObligationsCommandMetrics total={c.collections.length} shown={c.filteredCount} />
      }
    >
      <ResponsiveAccordionTabs
        tabs={c.PAGE_TABS}
        activeTab={c.effectiveTab}
        onTabChange={c.setActiveTab}
        panelIdPrefix="obligations-tab"
      >
        <AnimatePresence mode="wait">
          <ModuleTierMotion
            tier={
              c.effectiveTab +
              "-" +
              (c.effectiveTab === "setup" ? c.effectiveConfigTab : String(c.showDeleted))
            }
            className="space-y-4"
          >
            {c.effectiveTab === "reports" && (
              <Suspense fallback={<RouteStatusFallback />}>
                <ObligationsReportsTier />
              </Suspense>
            )}

            {c.effectiveTab === "work" && (
              <div className="space-y-5">
                <ObligationsWorkTier
                  collections={c.collections}
                  obligationTypes={c.obligationTypes}
                  reps={c.reps}
                  mujtahids={c.mujtahids}
                  listLoadFailed={c.listLoadFailed}
                  canWrite={c.canWrite}
                  canDelete={c.canDelete}
                  showDeleted={c.showDeleted}
                  canWriteMessaging={c.canWriteMessaging}
                  columnLayout={c.columnLayout}
                  onAddNew={() => c.setShowForm(true)}
                  onView={c.setViewCollection}
                  onFilteredCountChange={c.setFilteredCount}
                  onToggleShowDeleted={() => c.setShowDeleted((prev) => !prev)}
                  onDelete={c.handleDelete}
                  onRestore={c.handleRestore}
                  onBulkDelete={c.handleBulkDelete}
                  onBulkRestore={c.handleBulkRestore}
                  onRetry={c.refetchCollections}
                  onMessage={c.handleMessageCollections}
                  selectedIds={c.collectionSelection.selectedIds}
                  onToggleSelectedCollection={c.collectionSelection.toggleSelected}
                  onToggleSelectAll={c.collectionSelection.toggleSelectAll}
                  onClearSelection={c.collectionSelection.clearSelection}
                />
              </div>
            )}

            {c.effectiveTab === "setup" && (
              <Suspense fallback={<RouteStatusFallback />}>
                <ObligationsSetupTier
                  tabs={c.CONFIG_SUB_TABS}
                  activeTab={c.effectiveConfigTab}
                  canEditSetup={c.canEditSetup}
                  obligationTypes={c.obligationTypes}
                  mujtahids={c.mujtahids}
                  reps={c.reps}
                  wakalaTypes={c.wakalaTypes}
                  distributions={c.distributions}
                  onTabChange={c.setActiveConfigTab}
                  onChangeTypes={(next) => c.runSetupSave(() => c.replaceTypes.mutateAsync(next))}
                  onChangeMujtahids={(next) =>
                    c.runSetupSave(() => c.replaceMujtahids.mutateAsync(next))
                  }
                  onChangeReps={(next) => c.runSetupSave(() => c.replaceReps.mutateAsync(next))}
                  onChangeWakala={(next) => c.runSetupSave(() => c.replaceWakala.mutateAsync(next))}
                  onChangeDistributions={(next) =>
                    c.runSetupSave(() => c.replaceDistributions.mutateAsync(next))
                  }
                />
              </Suspense>
            )}
          </ModuleTierMotion>
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      <ObligationsModalLayer
        showForm={c.showForm}
        canWrite={c.canWrite}
        showDeleted={c.showDeleted}
        canDelete={c.canDelete}
        viewCollection={c.viewCollection}
        obligationTypes={c.obligationTypes}
        reps={c.reps}
        mujtahids={c.mujtahids}
        wakalaTypes={c.wakalaTypes}
        distributions={c.distributions}
        collections={c.collections}
        messagingTarget={c.messagingTarget}
        onSaveCollection={c.handleSaveCollection}
        onChangeTypes={
          c.canEditSetup
            ? (next) => c.runSetupSave(() => c.replaceTypes.mutateAsync(next))
            : undefined
        }
        onChangeMujtahids={
          c.canEditSetup
            ? (next) => c.runSetupSave(() => c.replaceMujtahids.mutateAsync(next))
            : undefined
        }
        onChangeReps={
          c.canEditSetup
            ? (next) => c.runSetupSave(() => c.replaceReps.mutateAsync(next))
            : undefined
        }
        onChangeWakala={
          c.canEditSetup
            ? (next) => c.runSetupSave(() => c.replaceWakala.mutateAsync(next))
            : undefined
        }
        onRestore={c.handleRestore}
        onCloseForm={() => c.setShowForm(false)}
        onCloseDetail={() => c.setViewCollection(null)}
        onCloseComposer={c.closeComposer}
      />

      <ObligationsCsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        canWrite={c.canWrite}
      />
    </ModulePageShell>
  );
}
