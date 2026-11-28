import type React from "react";
import { AnimatePresence } from "framer-motion";
import { WidgetBuilder } from "./pinnedWidgets/WidgetBuilder";
import type { CustomWidget } from "../lib/pinnedWidgetTypes";

interface PinnedWidgetsBuilderSectionProps {
  isBuilderOpen: boolean;
  defaultCollection: CustomWidget["collection"];
  editWidgetConfig: CustomWidget | null;
  category: string;
  onCancelEdit: () => void;
  onSaveWidget: (savedWidget: CustomWidget) => void;
  renderWidget: (widget: CustomWidget, isCompact: boolean) => React.ReactNode;
  existingWidgets?: CustomWidget[];
}

export function PinnedWidgetsBuilderSection({
  isBuilderOpen,
  defaultCollection,
  editWidgetConfig,
  category,
  onCancelEdit,
  onSaveWidget,
  renderWidget,
  existingWidgets,
}: PinnedWidgetsBuilderSectionProps): React.JSX.Element {
  return (
    <AnimatePresence>
      {isBuilderOpen && (
        <WidgetBuilder
          initialCollection={defaultCollection}
          editWidgetConfig={editWidgetConfig}
          onCancelEdit={onCancelEdit}
          onSaveWidget={onSaveWidget}
          category={category}
          renderWidget={renderWidget}
          existingWidgets={existingWidgets}
        />
      )}
    </AnimatePresence>
  );
}
