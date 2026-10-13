import React, { Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { ResponsiveAccordionTabs } from "@/components/app/ResponsiveAccordionTabs";
import { hasanatTransferSchema } from "@mms/shared";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { HasanatCommandMetrics } from "@/tenant/features/hasanat/components/HasanatCommandMetrics";
import { HasanatCsvImportDialog } from "@/tenant/features/hasanat/components/HasanatCsvImportDialog";
import { HasanatPageHeaderActions } from "@/tenant/features/hasanat/components/HasanatPageHeaderActions";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { HasanatWorkTier } from "@/tenant/features/hasanat/components/HasanatWorkTier";
import { useHasanatCardsPageController } from "@/tenant/features/hasanat/hooks/useHasanatCardsPageController";

const HasanatReportsTier = React.lazy(() =>
  import("@/tenant/features/hasanat/components/HasanatReportsTier").then((m) => ({
    default: m.HasanatReportsTier,
  })),
);
const HasanatSetupTier = React.lazy(() =>
  import("@/tenant/features/hasanat/components/HasanatSetupTier").then((m) => ({
    default: m.HasanatSetupTier,
  })),
);

const MessageComposer = React.lazy(
  () => import("@/tenant/components/messaging/TenantMessageComposer"),
);

/**
 * Hasanat Cards — denominations, stock, and redemptions. Work | Reports | Setup.
 */
import { DistributionDetail } from "@/tenant/features/hasanat/components/DistributionDetail";

export default function HasanatCards() {
  const c = useHasanatCardsPageController();
  const [importOpen, setImportOpen] = React.useState(false);
  const { handleExport, isExporting } = useGenericModuleExport({
    path: "/api/hasanat/export/csv",
    filename: "hasanat-cards.csv",
    auditPath: "/api/hasanat/export-audit",
    columns: hasanatTransferSchema.exportColumns,
    canExport: c.canWrite,
  });

  return (
    <>
      <ModulePageShell
        seoTitle={`MMS - ${c.t("nav.hasanatCards")}`}
        seoDescription={c.t("page.hasanat.subtitle")}
        headerIcon={Star}
        headerTitle={c.t("nav.hasanatCards")}
        headerSubtitle={c.t("page.hasanat.subtitle")}
        headerActions={
          <HasanatPageHeaderActions
            canWrite={c.canWrite}
            canExport={c.canWrite}
            showDeleted={c.showDeleted}
            isExporting={isExporting}
            onDistribute={c.openDistribute}
            onImport={() => setImportOpen(true)}
            onExport={handleExport}
          />
        }
        metricsStrip={<HasanatCommandMetrics shown={c.filteredCount} />}
      >
        <ResponsiveAccordionTabs
          tabs={c.PAGE_TABS}
          activeTab={c.effectiveTab}
          onTabChange={c.setActiveTab}
          panelIdPrefix="hasanat-tab"
        >
          <AnimatePresence mode="wait">
            <ModuleTierMotion
              tier={c.effectiveTab + "-" + c.effectiveSubTab + "-" + String(c.showDeleted)}
              className="space-y-4"
            >
              {c.effectiveTab === "reports" && (
                <Suspense fallback={<RouteStatusFallback />}>
                  <HasanatReportsTier />
                </Suspense>
              )}
              {c.effectiveTab === "setup" && (
                <Suspense fallback={<RouteStatusFallback />}>
                  <HasanatSetupTier
                    tabs={c.SETUP_TABS}
                    activeTab={c.effectiveConfigTab}
                    canEditSetup={c.canEditSetup}
                    canWrite={c.canWrite}
                    denoms={c.denoms}
                    onTabChange={c.setConfigSubTab}
                    onUpdateDenoms={(next) =>
                      c.runHasanatSave(() => c.replaceDenoms.mutateAsync(next))
                    }
                  />
                </Suspense>
              )}

              {c.effectiveTab === "work" && (
                <div className="space-y-5">
                  <HasanatWorkTier
                    tabs={c.SUB_TABS}
                    activeSubTab={c.effectiveSubTab}
                    showDeleted={c.showDeleted}
                    listLoadFailed={c.listLoadFailed}
                    canWrite={c.canWrite}
                    canDelete={c.canDelete}
                    canWriteMessaging={c.canWriteMessaging}
                    createDistributeKey={c.createDistributeKey}
                    denoms={c.denoms}
                    batches={c.batches}
                    distributions={c.distributions}
                    distributionColumnLayout={c.distributionColumnLayout}
                    redemptionColumnLayout={c.redemptionColumnLayout}
                    onSubTabChange={c.setActiveSubTab}
                    onToggleDeleted={() => c.setShowDeleted((prev) => !prev)}
                    onRetry={c.refetchDistributions}
                    onUpdateBatches={(next) =>
                      c.runHasanatSave(() => c.replaceBatches.mutateAsync(next))
                    }
                    onUpdateDenoms={(next) =>
                      c.runHasanatSave(() => c.replaceDenoms.mutateAsync(next))
                    }
                    onCreateDistribution={(distribution) =>
                      c.runHasanatSave(() => c.createDistribution.mutateAsync(distribution))
                    }
                    onUpdateDistribution={(distribution) =>
                      c.runHasanatSave(() => c.updateDistribution.mutateAsync(distribution))
                    }
                    onFilteredCountChange={c.setFilteredCount}
                    onDelete={c.handleDeleteDistribution}
                    onRowClick={c.setActiveDistribution}
                    onRestore={c.handleRestoreDistribution}
                    onBulkDelete={c.handleBulkDelete}
                    onBulkRestore={c.handleBulkRestore}
                    onMessage={c.handleMessageDistributions}
                    selectedIds={c.distributionSelection.selectedIds}
                    onToggleSelectedDistribution={c.distributionSelection.toggleSelected}
                    onToggleSelectAll={c.distributionSelection.toggleSelectAll}
                    onClearSelection={c.distributionSelection.clearSelection}
                  />
                </div>
              )}
            </ModuleTierMotion>
          </AnimatePresence>
        </ResponsiveAccordionTabs>

        {c.messagingTarget && (
          <Suspense fallback={null}>
            <MessageComposer
              channel={c.messagingTarget.channel}
              recipients={c.messagingTarget.recipients}
              onClose={c.closeComposer}
            />
          </Suspense>
        )}

        <HasanatCsvImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          canWrite={c.canWrite}
        />
      </ModulePageShell>

      <AnimatePresence>
        {c.activeDistribution && (
          <DistributionDetail
            distribution={c.activeDistribution}
            onClose={() => c.setActiveDistribution(null)}
            canDelete={c.canDelete}
            onRestore={(id) => c.handleRestoreDistribution(id)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
