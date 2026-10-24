import type { JSX } from "react";
import { motion } from "framer-motion";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Props for the report builder selected-field row. */
export interface DraggableFieldProps {
  /** The field name label. */
  field: string;
  /** Callback to remove this field from the selection. */
  onRemove: () => void;
  /** Callback to move this field one position earlier. */
  onMoveUp: () => void;
  /** Callback to move this field one position later. */
  onMoveDown: () => void;
  /** Whether this is the first field (disables move-up). */
  isFirst: boolean;
  /** Whether this is the last field (disables move-down). */
  isLast: boolean;
}

/**
 * Renders a single draggable/sortable field row within the selected-columns panel.
 *
 * @param props - The component props.
 * @returns The DraggableField component.
 */
export function DraggableField({
  field,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: DraggableFieldProps): JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      layout={!reducedMotion}
      initial={reducedMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 30 }}
      className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border border-border bg-card/60 backdrop-blur-md hover:bg-card/90 transition-colors group shadow-sm"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
        <span className="text-xs font-semibold text-foreground truncate">{field}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          disabled={isFirst}
          onClick={onMoveUp}
          variant="ghost"
          size="icon"
          className="rounded-lg hover:bg-muted disabled:opacity-20 text-xs text-muted-foreground font-black cursor-pointer transition-colors"
          type="button"
          title={t("reports.builder.moveUp")}
        >
          ▲
        </Button>
        <Button
          disabled={isLast}
          onClick={onMoveDown}
          variant="ghost"
          size="icon"
          className="rounded-lg hover:bg-muted disabled:opacity-20 text-xs text-muted-foreground font-black cursor-pointer transition-colors"
          type="button"
          title={t("reports.builder.moveDown")}
        >
          ▼
        </Button>
        <Button
          onClick={onRemove}
          variant="ghost"
          size="icon"
          className="rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-all"
          type="button"
          title={t("reports.builder.removeField")}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}
