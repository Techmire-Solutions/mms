import React, { type ElementType, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CardRemoveButton } from "@/components/app/FormCardChrome";
import { FORM_CARD } from "@/components/ui/formStyles";
import { CARD_STRIPE_BASE, CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const LIST_CARD_STRIPE = "bg-primary/60 group-hover:bg-primary";
const LIST_CARD_ICON = "text-primary/70 group-hover:text-primary";

export interface FormListFieldCardProps {
  id: string;
  index: number;
  icon?: ElementType;
  label?: string;
  typeSelect?: ReactNode;
  headerExtras?: ReactNode;
  onRemove?: () => void;
  removeLabel: string;
  /** When false, omit the remove control (e.g. minimum one required row). */
  canRemove?: boolean;
  children: ReactNode;
}

/**
 * SSOT card chrome for repeatable form collection rows
 * (contacts phones/emails, faculty designation holdings, etc.).
 */
export function FormListFieldCard({
  id,
  index,
  icon: Icon,
  label,
  typeSelect,
  headerExtras,
  onRemove,
  removeLabel,
  canRemove = true,
  children,
}: FormListFieldCardProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const showRemove = canRemove && typeof onRemove === "function";
  const hasHeaderContent = Boolean(Icon || label || typeSelect || headerExtras);

  return (
    <motion.div
      key={id}
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.15 }}
      style={{ zIndex: Math.max(1, 10 - index) }}
      className={cn(FORM_CARD, "p-4.5 space-y-4", CARD_STRIPE_INSET)}
    >
      <div
        aria-hidden="true"
        className={cn(CARD_STRIPE_BASE, "transition-colors", LIST_CARD_STRIPE)}
      />
      {hasHeaderContent ? (
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-border/50">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {Icon ? (
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted/70",
                  LIST_CARD_ICON,
                )}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden />
              </div>
            ) : null}
            {label ? (
              <span className="min-w-0 truncate text-xs font-semibold text-foreground/80">
                {label}
              </span>
            ) : null}
            {typeSelect}
            {headerExtras}
          </div>
          {showRemove ? <CardRemoveButton onClick={onRemove} label={removeLabel} /> : null}
        </div>
      ) : showRemove ? (
        <div className="flex justify-end -mb-2">
          <CardRemoveButton onClick={onRemove} label={removeLabel} />
        </div>
      ) : null}
      {children}
    </motion.div>
  );
}
