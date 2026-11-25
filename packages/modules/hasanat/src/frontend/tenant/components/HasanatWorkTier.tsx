import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ErrorState } from "@mms/fe-core/components/ErrorState";
import { SubTabBar } from "@mms/ui/app/SubTabBar";
import { useTranslation } from "@mms/fe-core/i18n";
import { DistributionsList } from "./DistributionsList.js";
import { HasanatDashboard } from "./HasanatDashboard.js";
import { RedemptionTracker } from "./RedemptionTracker.js";
import { StockManager } from "./StockManager.js";
import type { useHasanatDistributionColumnLayout } from "../hooks/useHasanatDistributionColumnLayout";
import type { useHasanatRedemptionColumnLayout } from "../hooks/useHasanatRedemptionColumnLayout";
import type { Denomination, Distribution, DistributionWrite, StockBatch } from "../lib/hasanatData";

interface WorkTab {
  id: string;
  label: string;
}

interface HasanatWorkTierProps {
  tabs: WorkTab[];
  activeSubTab: string;
  listLoadFailed: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canWriteMessaging?: boolean;
  showDeleted: boolean;
  createDistributeKey?: number;
  denoms: Denomination[];
  batches: StockBatch[];
  distributions: Distribution[];
  distributionColumnLayout: ReturnType<typeof useHasanatDistributionColumnLayout>;
  redemptionColumnLayout: ReturnType<typeof useHasanatRedemptionColumnLayout>;
  onSubTabChange: (tab: string) => void;
  onRetry: () => void;
  onUpdateBatches: (batches: StockBatch[]) => void | Promise<void>;
  onUpdateDenoms?: (denoms: Denomination[]) => void | Promise<void>;
  onCreateDistribution: (distribution: DistributionWrite) => void | Promise<void>;
  onUpdateDistribution: (distribution: Distribution) => void | Promise<void>;
  onFilteredCountChange: (count: number) => void;
  onToggleDeleted: () => void;
  onDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkRestore: (ids: string[]) => Promise<void>;
  onMessage: (channel: "sms" | "whatsapp" | "email", distributions: Distribution[]) => void;
  onRowClick?: (distribution: Distribution) => void;
  selectedIds?: string[];
  onToggleSelectedDistribution?: (id: string, checked: boolean) => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: string[]) => void;
  onClearSelection?: () => void;
}

export function HasanatWorkTier({
  tabs,
  activeSubTab,
  listLoadFailed,
  canWrite,
  canDelete,
  canWriteMessaging = false,
  showDeleted,
  createDistributeKey,
  denoms,
  batches,
  distributions,
  distributionColumnLayout,
  redemptionColumnLayout,
  onSubTabChange,
  onRetry,
  onUpdateBatches,
  onUpdateDenoms,
  onCreateDistribution,
  onUpdateDistribution,
  onFilteredCountChange,
  onToggleDeleted,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  onMessage,
  onRowClick,
  selectedIds,
  onToggleSelectedDistribution,
  onToggleSelectAll,
  onClearSelection,
}: HasanatWorkTierProps) {
  const { t } = useTranslation();

  return (
    <ErrorBoundary>
      <SubTabBar
        tabs={tabs.map((tab) => ({ key: tab.id, label: tab.label }))}
        value={activeSubTab}
        onChange={(next) => {
          onSubTabChange(next);
          if (next !== "distribute" && showDeleted) onToggleDeleted();
        }}
      />

      {listLoadFailed ? (
        <ErrorState
          title={t("hasanat.loadFailed")}
          description={t("hasanat.loadFailedHint")}
          onRetry={onRetry}
        />
      ) : (
        <>
          {activeSubTab === "overview" && (
            <HasanatDashboard denoms={denoms} batches={batches} distributions={distributions} />
          )}
          {activeSubTab === "stock" && (
            <StockManager
              batches={batches}
              denoms={denoms}
              onUpdate={onUpdateBatches}
              onUpdateDenoms={onUpdateDenoms}
              canWrite={canWrite}
            />
          )}
          {activeSubTab === "distribute" && (
            <DistributionsList
              denoms={denoms}
              batches={batches}
              onCreate={onCreateDistribution}
              onUpdate={onUpdateDistribution}
              onDenomsChange={onUpdateDenoms}
              onFilteredCountChange={onFilteredCountChange}
              canWrite={canWrite}
              canDelete={canDelete}
              showDeleted={showDeleted}
              onToggleDeleted={onToggleDeleted}
              createRequestKey={createDistributeKey}
              onDelete={onDelete}
              onRestore={onRestore}
              onRowClick={onRowClick}
              onBulkDelete={onBulkDelete}
              onBulkRestore={onBulkRestore}
              selectedIds={selectedIds}
              onToggleSelectedDistribution={onToggleSelectedDistribution}
              onToggleSelectAll={onToggleSelectAll}
              onClearSelection={onClearSelection}
              isColumnVisible={distributionColumnLayout.isColumnVisible}
              getColumnWidth={distributionColumnLayout.getColumnWidth}
              onColumnResize={distributionColumnLayout.setColumnWidth}
              columnCustomizer={{
                columnRegistry: distributionColumnLayout.columnRegistry,
                updateUserColumnLayout: distributionColumnLayout.updateUserColumnLayout,
                onResetLayout: distributionColumnLayout.resetColumnLayout,
                labels: distributionColumnLayout.customizerLabels,
              }}
              onMessage={canWriteMessaging && !showDeleted ? onMessage : undefined}
            />
          )}
          {activeSubTab === "redemptions" && (
            <RedemptionTracker
              distributions={distributions}
              onFilteredCountChange={onFilteredCountChange}
              canWrite={canWrite}
              columnLayout={redemptionColumnLayout}
            />
          )}
        </>
      )}
    </ErrorBoundary>
  );
}
