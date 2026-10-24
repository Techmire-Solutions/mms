import { capitalize, type AppTranslationKey } from "@mms/shared";
import { resolveWidgetTitle } from "@/lib/dashboardWidgets";
import { METADATA_FIELDS, getCollectionLabel } from "@/lib/reports/reportMetadata";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export function getWidgetSubtitle(
  widget: CustomWidget,
  resolvedWidgetType: string,
  t: TranslationFunction,
): string {
  const widgetTitle = resolveWidgetTitle(widget, t);
  const collectionLabel = getCollectionLabel(
    widget.collection,
    METADATA_FIELDS[widget.collection]?.name || widget.collection,
    t,
  );
  const showCollection = !widgetTitle.toLowerCase().includes(collectionLabel.toLowerCase());
  const formulaPart =
    resolvedWidgetType !== "switch"
      ? t(`reports.widgets.builder.formula${capitalize(widget.operation)}` as AppTranslationKey) ||
        widget.operation
      : "";

  return showCollection
    ? `${collectionLabel}${formulaPart ? ` • ${formulaPart}` : ""}`
    : formulaPart;
}
