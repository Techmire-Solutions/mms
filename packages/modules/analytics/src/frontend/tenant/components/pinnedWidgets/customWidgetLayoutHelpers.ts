import { capitalize, type AppTranslationKey } from "@mms/contracts";
import { resolveWidgetTitle } from "../../host/reportLibs";
import { METADATA_FIELDS, getCollectionLabel } from "../../lib/reportMetadata";
import type { CustomWidget } from "../../lib/pinnedWidgetTypes";
import type { TranslationFunction } from "@mms/fe-core/i18n";

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
