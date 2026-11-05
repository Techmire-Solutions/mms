import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Check } from "lucide-react";
import type { ContactPreferences } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { Modal } from "@/components/app/Modal";
import { ErrorState } from "@/components/app/ErrorState";
import { Alert } from "@/components/app/Alert";
import { useTranslation } from "@/hooks/useTranslation";
import { ModulePanelSuspenseFallback } from "@/components/app/ModulePanelSuspenseFallback";
import { DuplicatePairCard } from "@/tenant/features/contacts/components/DuplicatePairCard";
import { DuplicateDetectionToolbar } from "@/tenant/features/contacts/components/DuplicateDetectionToolbar";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import type { DuplicatePair } from "@/tenant/features/contacts/lib/duplicateDetectionTypes";
import type { DuplicateTierFilter } from "@/tenant/features/contacts/hooks/useDuplicateDetectionState";

const VIRTUALIZE_PAIR_THRESHOLD = 30;

export interface DuplicateDetectionModalProps {
  prefs: ContactPreferences;
  pairsLoading: boolean;
  pairsFetching: boolean;
  pairsError: boolean;
  hasMore: boolean;
  activePairs: DuplicatePair[];
  totalPairs: number;
  tierCounts: { all: number; high: number; medium: number; low: number };
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  tierFilter: DuplicateTierFilter;
  setTierFilter: (tier: DuplicateTierFilter) => void;
  keepIndex: Record<string, number>;
  totalMerged: number;
  canWrite: boolean;
  highConfidenceCount?: number;
  batchMerging?: boolean;
  batchConfirmOpen?: boolean;
  setBatchConfirmOpen?: (open: boolean) => void;
  onBatchMergeConfirm?: () => Promise<void>;
  onClose: () => void;
  onMergePair: (pair: DuplicatePair) => void;
  onDismiss: (pairId: string) => void;
  onSelectKeep: (pairId: string, contactIndex: number) => void;
  onLoadMore: () => void;
  onRetry: () => void;
}

export function DuplicateDetectionModal({
  prefs,
  pairsLoading,
  pairsFetching,
  pairsError,
  hasMore,
  activePairs,
  totalPairs,
  tierCounts,
  searchQuery,
  setSearchQuery,
  tierFilter,
  setTierFilter,
  keepIndex,
  totalMerged,
  canWrite,
  highConfidenceCount = 0,
  batchMerging = false,
  batchConfirmOpen = false,
  setBatchConfirmOpen,
  onBatchMergeConfirm,
  onClose,
  onMergePair,
  onDismiss,
  onSelectKeep,
  onLoadMore,
  onRetry,
}: DuplicateDetectionModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  // Rule: lists > 30 items are virtualized. "Load more" appends 50 pairs at a
  // time, and each pair card is heavy — render only the visible window.
  const isVirtualized = activePairs.length > VIRTUALIZE_PAIR_THRESHOLD;
  const pairVirtualizer = useVirtualizer({
    count: activePairs.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 280,
    overscan: 4,
    enabled: isVirtualized,
  });
  const virtualPairs = isVirtualized ? pairVirtualizer.getVirtualItems() : [];

  const renderPair = (pair: DuplicatePair) => (
    <div key={pair.id} data-pair-id={pair.id}>
      <DuplicatePairCard
        pair={pair}
        prefs={prefs}
        selectedKeepIndex={keepIndex[pair.id] ?? 0}
        canWrite={canWrite}
        onMerge={() => onMergePair(pair)}
        onDismiss={() => onDismiss(pair.id)}
        onSelectKeep={(contactIndex) => onSelectKeep(pair.id, contactIndex)}
        t={t}
      />
    </div>
  );

  const filterTabs: Array<{ id: DuplicateTierFilter; label: string; count: number }> = [
    { id: "all", label: t("contacts.duplicates.filterAll"), count: tierCounts.all },
    { id: "high", label: t("contacts.duplicates.filterHigh"), count: tierCounts.high },
    { id: "medium", label: t("contacts.duplicates.filterMedium"), count: tierCounts.medium },
    { id: "low", label: t("contacts.duplicates.filterLow"), count: tierCounts.low },
  ];

  return (
    <>
      <Modal
        open={true}
        onClose={onClose}
        title={t("contacts.duplicates.title")}
        subtitle={t("contacts.duplicates.potentialFound", { count: totalPairs })}
        icon={AlertTriangle}
        size="lg"
        footer={
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="min-h-11 px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors bg-transparent hover:bg-muted"
          >
            {t("common.close")}
          </Button>
        }
      >
        <div className="space-y-4">
          {totalMerged > 0 && (
            <Alert
              tone="success"
              density="compact"
              icon={Check}
              description={t("contacts.duplicates.countMerged", { count: totalMerged })}
            />
          )}

          {!canWrite && activePairs.length > 0 && (
            <Alert
              tone="warning"
              density="compact"
              description={t("contacts.duplicatesReadOnly")}
            />
          )}

          <DuplicateDetectionToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            tierFilter={tierFilter}
            onTierFilterChange={setTierFilter}
            filterTabs={filterTabs}
            searchPlaceholder={t("contacts.duplicates.searchPlaceholder")}
            canWrite={canWrite}
            highConfidenceCount={highConfidenceCount}
            batchMerging={batchMerging}
            onBatchMergeClick={setBatchConfirmOpen ? () => setBatchConfirmOpen(true) : undefined}
          />

          {pairsError ? (
            <ErrorState
              title={t("contacts.duplicates.scanFailed")}
              description={t("contacts.duplicates.scanFailedHint")}
              onRetry={onRetry}
            />
          ) : pairsLoading ? (
            <ModulePanelSuspenseFallback spinnerClassName="h-8 w-8" />
          ) : activePairs.length === 0 ? (
            <EmptyState
              title={t("contacts.duplicates.allResolved")}
              description={t("contacts.duplicates.listClean")}
              icon={Check}
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {t("contacts.duplicates.dismissSessionHint")}
              </p>
              {isVirtualized ? (
                <div ref={listScrollRef} className="max-h-[min(60vh,640px)] overflow-y-auto pe-1">
                  <div
                    style={{ height: pairVirtualizer.getTotalSize(), position: "relative" }}
                    data-testid="duplicate-pairs-virtual-window"
                  >
                    {virtualPairs.map((virtualRow) => {
                      const pair = activePairs[virtualRow.index];
                      if (!pair) return null;
                      return (
                        <div
                          key={pair.id}
                          data-index={virtualRow.index}
                          ref={pairVirtualizer.measureElement}
                          style={{
                            position: "absolute",
                            top: 0,
                            insetInlineStart: 0,
                            width: "100%",
                            transform: `translateY(${virtualRow.start}px)`,
                            paddingBottom: 12,
                          }}
                        >
                          {renderPair(pair)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                activePairs.map(renderPair)
              )}
            </>
          )}

          {hasMore && !pairsError && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onLoadMore}
                disabled={pairsFetching}
                className="font-semibold"
              >
                {pairsFetching ? t("common.loading") : t("contacts.duplicates.loadMore")}
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {setBatchConfirmOpen && onBatchMergeConfirm && (
        <ConfirmAlertDialog
          open={Boolean(batchConfirmOpen)}
          onOpenChange={setBatchConfirmOpen}
          onConfirm={onBatchMergeConfirm}
          title={t("contacts.duplicates.batchMergeConfirmTitle")}
          description={t("contacts.duplicates.batchMergeConfirmDescription", {
            count: highConfidenceCount,
          })}
          confirmLabel={t("contacts.duplicates.merge")}
        />
      )}
    </>
  );
}
