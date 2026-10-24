import React from "react";
import { PinnedWidgetsBuilderSection } from "@/components/reports/PinnedWidgetsBuilderSection";
import { PinnedWidgetsChrome } from "@/components/reports/PinnedWidgetsChrome";
import { PinnedWidgetsGrid } from "@/components/reports/PinnedWidgetsGrid";
import { usePinnedWidgetsController } from "@/tenant/features/reports/hooks/usePinnedWidgetsController";
import { CustomWidgetRenderer } from "@/tenant/features/reports/components/pinnedWidgets/CustomWidgetRenderer";
import { applyContactsWidgetWorkDrillDown } from "@/lib/contacts/contactsWidgetWorkDrillDown";

export type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
export {
  getWidgetCollections,
  getFilteredRecords,
  computeWidgetSingleValue,
} from "@/lib/reports/widgetDataUtils";
export { getOrInitializeCustomWidgets } from "@/lib/reports/widgetDefaults";
export { DashboardWidgets } from "@/tenant/features/reports/components/pinnedWidgets/DashboardWidgets";
export { WidgetBuilder } from "@/components/reports/pinnedWidgets/WidgetBuilder";

/**
 * PinnedWidgets Main Module Component. Exposes custom Widget builders.
 */
export default function PinnedWidgets({ category }: { category: string }): React.JSX.Element {
  const {
    t,
    disabledCardIds,
    toggleCardVisibility,
    sectionSettings,
    toggleSectionSetting,
    widgets,
    filteredWidgets,
    collections,
    isBuilderOpen,
    editingWidgetId,
    defaultCollection,
    handleToggleBuilder,
    handleCancelBuilder,
    handleSaveWidget,
    handleDeleteWidget,
    handleTogglePin,
    handleEditClick,
    handleToggleSwitchStateLocal,
  } = usePinnedWidgetsController(category);

  return (
    <div className="space-y-4 font-sans text-start">
      <PinnedWidgetsChrome
        category={category}
        isBuilderOpen={isBuilderOpen}
        disabledCardIds={disabledCardIds}
        sectionSettings={sectionSettings}
        toggleCardVisibility={toggleCardVisibility}
        toggleSectionSetting={toggleSectionSetting}
        onToggleBuilder={handleToggleBuilder}
        t={t}
      />

      <PinnedWidgetsBuilderSection
        isBuilderOpen={isBuilderOpen}
        defaultCollection={defaultCollection}
        editWidgetConfig={widgets.find((widget) => widget.id === editingWidgetId) || null}
        category={category}
        onCancelEdit={handleCancelBuilder}
        onSaveWidget={handleSaveWidget}
        renderWidget={(widget, isCompact) => (
          <CustomWidgetRenderer
            widget={widget}
            collections={collections}
            isCompact={isCompact}
            onSwitchToggle={handleToggleSwitchStateLocal}
            onMetricClick={(clicked) => {
              if (applyContactsWidgetWorkDrillDown(clicked)) return;
            }}
          />
        )}
      />

      <PinnedWidgetsGrid
        filteredWidgets={filteredWidgets}
        collections={collections}
        onTogglePin={handleTogglePin}
        onEditClick={handleEditClick}
        onDeleteWidget={handleDeleteWidget}
        onSwitchToggle={handleToggleSwitchStateLocal}
        t={t}
        renderWidget={(widget, collectionArg) => (
          <CustomWidgetRenderer
            widget={widget}
            collections={collectionArg}
            onSwitchToggle={handleToggleSwitchStateLocal}
            onMetricClick={(clicked) => {
              if (applyContactsWidgetWorkDrillDown(clicked)) return;
            }}
          />
        )}
      />
    </div>
  );
}
