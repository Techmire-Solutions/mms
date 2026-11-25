import { useState } from "react";
import { METADATA_FIELDS } from "@/lib/reports/reportMetadata";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

type Collection = CustomWidget["collection"];

/** First numeric field offered by a collection, or "" when unknown. */
export function defaultTargetField(collection: Collection): string {
  return METADATA_FIELDS[collection]?.numericFields[0]?.value ?? "";
}

/** First filterable field offered by a collection, or "" when unknown. */
export function defaultFilterField(collection: Collection): string {
  return METADATA_FIELDS[collection]?.fields[0]?.value ?? "";
}

/** Editing a widget of the initial collection keeps its own saved target field. */
export function initialTargetField(collection: Collection, edit: CustomWidget | null): string {
  return edit?.collection === collection ? "" : defaultTargetField(collection);
}

/** Editing a widget of the initial collection keeps its own saved filter field. */
export function initialFilterField(collection: Collection, edit: CustomWidget | null): string {
  return edit?.collection === collection ? "" : defaultFilterField(collection);
}

interface UseWidgetBuilderCollectionDefaultsOptions {
  collection: Collection;
  editWidgetConfig: CustomWidget | null;
  setBuilderTargetField: (value: string) => void;
  setBuilderFilterField: (value: string) => void;
}

/**
 * Default the target/filter drafts whenever the collection changes, except while
 * hydrating an existing widget that already owns its saved fields. Adjusted during
 * render (React's documented prop-change pattern) so the preview never recomputes
 * against the previous collection's fields.
 */
export function useWidgetBuilderCollectionDefaults({
  collection,
  editWidgetConfig,
  setBuilderTargetField,
  setBuilderFilterField,
}: UseWidgetBuilderCollectionDefaultsOptions): void {
  const [anchorCollection, setAnchorCollection] = useState(collection);
  const [anchorEditId, setAnchorEditId] = useState(editWidgetConfig?.id);

  if (anchorCollection !== collection || anchorEditId !== editWidgetConfig?.id) {
    setAnchorCollection(collection);
    setAnchorEditId(editWidgetConfig?.id);
    if (!(editWidgetConfig && editWidgetConfig.collection === collection)) {
      setBuilderFilterField(defaultFilterField(collection));
      setBuilderTargetField(defaultTargetField(collection));
    }
  }
}
