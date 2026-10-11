import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface FilterChipsProps {
  chips: FilterChip[];
  onClearAll?: () => void;
  /** Max chips to show before collapsing into "+n more" disclosure. Default: 4. */
  maxVisible?: number;
  className?: string;
}

/**
 * FilterChips — shows active filter pills with clear actions.
 * Chip models come from {@link useDescriptorFilterChips} (SSOT); this is presentation only.
 */
export function FilterChips({
  chips,
  onClearAll,
  maxVisible = 4,
  className,
}: FilterChipsProps): React.ReactElement | null {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);

  if (chips.length === 0) return null;

  const overflow = chips.length > maxVisible;
  const visibleChips = overflow && !expanded ? chips.slice(0, maxVisible) : chips;
  const hiddenCount = chips.length - maxVisible;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className={cn("flex items-center gap-2 flex-wrap", className)}
      >
        {visibleChips.map((chip) => (
          <Badge
            key={chip.key}
            as="button"
            tone="primary"
            pill
            size="sm"
            onClick={chip.onRemove}
            aria-label={chip.label}
            title={chip.label}
            className="min-h-11 px-3 py-2 text-xs font-semibold gap-1.5 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>{chip.label}</span>
            <X className="w-3 h-3 shrink-0" aria-hidden="true" />
          </Badge>
        ))}

        {overflow && (
          <Badge
            as="button"
            tone="secondary"
            pill
            size="sm"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="min-h-11 px-3 py-2 text-xs font-semibold gap-1 border border-border/60 bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" aria-hidden="true" />
                {t("common.showLess" as never) || "Show less"}
              </>
            ) : (
              <>
                +{hiddenCount}
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
              </>
            )}
          </Badge>
        )}

        {chips.length > 1 && onClearAll && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="min-h-11 text-xs text-muted-foreground hover:text-foreground underline transition-colors px-2"
          >
            {t("common.clearFilters")}
          </Button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
