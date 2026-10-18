import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FORM_LABEL, WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";
import { CARD_STRIPE_BASE, CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";

export type DetailAttributeRowVariant = "card" | "list" | "inset";

export interface DetailAttributeRowProps {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  variant?: DetailAttributeRowVariant;
  /** Overrides the icon color/class (e.g. gender-aware tones). */
  iconClassName?: string;
  className?: string;
}

/**
 * Presentational attribute row for person-directory detail drawers.
 * `card` = glass tile with accent bar (Students); `list` = border-b row (Teachers);
 * `inset` = muted icon box inside a section card (Contacts FieldGroupCard).
 */
export function DetailAttributeRow({
  icon: Icon,
  label,
  value,
  variant = "card",
  iconClassName,
  className,
}: DetailAttributeRowProps): React.JSX.Element {
  if (variant === "list") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 border-b border-border/40 py-3 last:border-b-0",
          className,
        )}
      >
        {Icon && (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
            <Icon className={cn("h-4 w-4", iconClassName)} aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn(FORM_LABEL, "mb-0")}>{label}</p>
          <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
        </div>
      </div>
    );
  }

  if (variant === "inset") {
    return (
      <div className={cn("flex items-center gap-3 p-3 group/row", className)}>
        {Icon && (
          <div className="rounded-lg bg-muted/80 p-2 transition-colors group-hover/row:bg-primary/10">
            <Icon
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                iconClassName ?? "text-muted-foreground group-hover/row:text-primary",
              )}
              aria-hidden
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-bold uppercase leading-none tracking-tight text-muted-foreground">
            {label}
          </span>
          <span className="block truncate text-sm font-semibold text-foreground">{value}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        `relative overflow-hidden group/row flex items-center gap-3 p-3 ${CARD_STRIPE_INSET} ${WORK_SURFACE_INNER} hover:shadow-md transition-all duration-200`,
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          CARD_STRIPE_BASE,
          "bg-primary/40 group-hover/row:bg-primary transition-colors",
        )}
      />
      {Icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className={cn("h-4 w-4", iconClassName)} aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn(FORM_LABEL, "mb-0")}>{label}</p>
        <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
}
