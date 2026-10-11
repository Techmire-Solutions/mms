import React from "react";
import {
  WidgetBuilder,
  type CustomWidget,
} from "@/tenant/features/reports/components/PinnedWidgets";
import { CustomWidgetRenderer } from "@/tenant/features/reports/components/pinnedWidgets/CustomWidgetRenderer";
import { type CustomCard } from "@/lib/reports/reportMetadata";
import { getObject, saveObject } from "@/lib/db";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";

interface DynamicCardBuilderProps {
  initialCollection?: CustomCard["collection"];
  mode?: "dashboard" | "kpi";
  category?: string;
  editCardConfig?: CustomCard | null;
  onCancelEdit?: () => void;
}

export default function DynamicCardBuilder({
  initialCollection,
  mode = "dashboard",
  category = "students",
  editCardConfig = null,
  onCancelEdit,
}: DynamicCardBuilderProps): React.JSX.Element {
  // Convert CustomCard to CustomWidget
  const editWidgetConfig = (() => {
    if (!editCardConfig) return null;

    return {
      id: editCardConfig.id,
      title: editCardConfig.title,
      category,
      collection: editCardConfig.collection,
      widgetType: "card",
      operation: editCardConfig.operation,
      targetField: editCardConfig.targetField,
      filterField: editCardConfig.filterField,
      filterOperator: editCardConfig.filterOperator,
      filterValue: editCardConfig.filterValue,
      color: editCardConfig.color,
      isPinnedToDashboard: false,
      icon: editCardConfig.icon,
      subTextType: editCardConfig.subTextType,
      fixedSubText: editCardConfig.fixedSubText,
      trend: editCardConfig.trend,
      trendType: editCardConfig.trendType,
      role: editCardConfig.role,
    };
  })() as CustomWidget | null;

  const { saveWidget } = useDashboardConfig();

  const handleSaveWidget = async (savedWidget: CustomWidget) => {
    // Convert CustomWidget to CustomCard
    const newCard: CustomCard = {
      id: savedWidget.id,
      role: savedWidget.role,
      title: savedWidget.title,
      collection: savedWidget.collection,
      operation: savedWidget.operation,
      targetField: savedWidget.targetField,
      filterField: savedWidget.filterField,
      filterOperator: savedWidget.filterOperator,
      filterValue: savedWidget.filterValue,
      icon: savedWidget.icon || "GraduationCap",
      color: savedWidget.color,
      subTextType: savedWidget.subTextType || "dynamic",
      fixedSubText: savedWidget.fixedSubText,
      trend: savedWidget.trend,
      trendType: savedWidget.trendType,
    };

    if (mode === "kpi") {
      const existingCards = getObject<CustomCard[]>(`kpi_custom_cards_${category}`, []);
      let updatedCards: CustomCard[];
      if (editCardConfig) {
        updatedCards = existingCards.map((card) =>
          card.id === editCardConfig.id ? newCard : card,
        );
      } else {
        updatedCards = [...existingCards, newCard];
      }
      saveObject(`kpi_custom_cards_${category}`, updatedCards);
    } else {
      // Persist to the server-authoritative dashboard widgets store (upsert affected widget).
      // Await so the builder closes only on success (§7); onError toasts on failure.
      try {
        await saveWidget(savedWidget);
      } catch {
        return;
      }
    }

    if (onCancelEdit) {
      onCancelEdit();
    }
    if (mode === "kpi") {
      window.dispatchEvent(new Event("local-database-update"));
    }
  };

  const handleCancelEdit = () => {
    onCancelEdit?.();
  };

  return (
    <WidgetBuilder
      initialCollection={initialCollection || "contacts"}
      editWidgetConfig={editWidgetConfig}
      onCancelEdit={handleCancelEdit}
      onSaveWidget={handleSaveWidget}
      category={category}
      mode={mode}
      initialWidgetType="card"
      renderWidget={(widget, isCompact) => (
        <CustomWidgetRenderer
          widget={widget}
          collections={{} as Parameters<typeof CustomWidgetRenderer>[0]["collections"]}
          isCompact={isCompact}
          onSwitchToggle={() => {}}
          onMetricClick={() => {}}
        />
      )}
    />
  );
}
