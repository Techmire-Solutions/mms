import { KPISummarySettings } from "@/components/reports/kpiSummarySettings";
import { KPICardsGrid } from "@/components/reports/kpiSummaryCards";
import type { KPISummaryProps } from "@/components/reports/kpiSummaryTypes";
import { useKPISummaryModel } from "@/tenant/features/reports/hooks/useKPISummaryModel";
import DynamicCardBuilder from "@/tenant/features/reports/components/DynamicCardBuilder";

export default function KPISummary({ category, role }: KPISummaryProps): JSX.Element {
  const model = useKPISummaryModel({ category, role });

  return (
    <div className="w-full space-y-3">
      <KPISummarySettings
        category={category}
        moduleLabel={model.moduleLabel}
        isOpen={model.isConfigOpen}
        cards={model.possibleCards}
        customCards={model.customCards}
        selectedCardIds={model.selectedCardIds}
        primaryVolume={model.primaryVolume}
        defaultCollection={model.defaultCollection}
        editingCardConfig={model.editingCardConfig}
        cardBuilder={
          <DynamicCardBuilder
            mode="kpi"
            category={category}
            initialCollection={model.defaultCollection}
            editCardConfig={model.editingCardConfig}
            onCancelEdit={model.cancelEdit}
          />
        }
        onOpenChange={model.setIsConfigOpen}
        onCancelEdit={model.cancelEdit}
        onToggleCard={model.handleToggleCard}
        onEditCard={model.handleEditCard}
        onDeleteCard={model.handleDeleteCustomCard}
      />
      <KPICardsGrid cards={model.visibleCards} onAddCustom={model.openCustomCardBuilder} />
    </div>
  );
}
