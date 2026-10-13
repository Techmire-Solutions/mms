import type React from "react";
import { AnimatePresence } from "framer-motion";
import { WidgetBuilder } from "@/components/ui/reports/pinnedWidgets/WidgetBuilder";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

interface PinnedWidgetsBuilderSectionProps {
  isBuilderOpen: boolean;
  defaultCollection: CustomWidget["collection"];
  editWidgetConfig: CustomWidget | null;
  category: string;
  onCancelEdit: () => void;
  onSaveWidget: (savedWidget: CustomWidget) => void;
  renderWidget: (widget: CustomWidget, isCompact: boolean) => React.ReactNode;
}

export function PinnedWidgetsBuilderSection({
  isBuilderOpen,
  defaultCollection,
  editWidgetConfig,
  category,
  onCancelEdit,
  onSaveWidget,
  renderWidget,
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
        />
      )}
    </AnimatePresence>
  );
}
