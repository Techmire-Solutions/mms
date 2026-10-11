import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ErrorState } from "@/components/ui/ErrorState";
import { ModuleTierMotion } from "@/components/ui/ModuleTierMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { ObligationCollectionsList } from "@/tenant/features/obligations/components/ObligationCollectionsList";
import type { useObligationColumnLayout } from "@/tenant/features/obligations/hooks/useObligationColumnLayout";
import type {
  ObligationCollection,
  ObligationType,
  Mujtahid,
  MujtahidRep,
} from "@/lib/data/obligationsData";

interface ObligationsWorkTierProps {
  collections: ObligationCollection[];
  obligationTypes: ObligationType[];
  reps: MujtahidRep[];
  mujtahids: Mujtahid[];
  listLoadFailed: boolean;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  canWriteMessaging: boolean;
  columnLayout: ReturnType<typeof useObligationColumnLayout>;
  onAddNew: () => void;
  onView: (collection: ObligationCollection) => void;
  onFilteredCountChange: (count: number) => void;
  onToggleShowDeleted: () => void;
  onDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkRestore: (ids: string[]) => Promise<void>;
  onRetry: () => void;
  onMessage: (channel: "sms" | "whatsapp" | "email", collections: ObligationCollection[]) => void;
  selectedIds?: string[];
  onToggleSelectedCollection?: (id: string, checked: boolean) => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: string[]) => void;
  onClearSelection?: () => void;
}

export function ObligationsWorkTier({
  collections,
  obligationTypes,
  reps,
  mujtahids,
  listLoadFailed,
  canWrite,
  canDelete,
  showDeleted,
  canWriteMessaging,
  columnLayout,
  onAddNew,
  onView,
  onFilteredCountChange,
  onToggleShowDeleted,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  onRetry,
  onMessage,
  selectedIds,
  onToggleSelectedCollection,
  onToggleSelectAll,
  onClearSelection,
}: ObligationsWorkTierProps) {
  const { t } = useTranslation();

  if (listLoadFailed) {
    return (
      <ErrorState
        title={t("obligations.loadFailed")}
        description={t("obligations.loadFailedHint")}
        onRetry={onRetry}
      />
    );
  }

  return (
    <ErrorBoundary>
      <ModuleTierMotion tier="work" className="space-y-4">
        <ObligationCollectionsList
          collections={collections}
          obligationTypes={obligationTypes}
          reps={reps}
          mujtahids={mujtahids}
          onAddNew={onAddNew}
          onView={onView}
          onFilteredCountChange={onFilteredCountChange}
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          onToggleShowDeleted={onToggleShowDeleted}
          onDelete={onDelete}
          onRestore={onRestore}
          onBulkDelete={onBulkDelete}
          onBulkRestore={onBulkRestore}
          selectedIds={selectedIds}
          onToggleSelectedCollection={onToggleSelectedCollection}
          onToggleSelectAll={onToggleSelectAll}
          onClearSelection={onClearSelection}
          isColumnVisible={columnLayout.isColumnVisible}
          getColumnWidth={columnLayout.getColumnWidth}
          onColumnResize={columnLayout.setColumnWidth}
          columnCustomizer={{
            columnRegistry: columnLayout.columnRegistry,
            updateUserColumnLayout: columnLayout.updateUserColumnLayout,
            onResetLayout: columnLayout.resetColumnLayout,
            labels: columnLayout.customizerLabels,
          }}
          onMessage={canWriteMessaging && !showDeleted ? onMessage : undefined}
        />
      </ModuleTierMotion>
    </ErrorBoundary>
  );
}
