import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TableCellLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Muted subtitle link (font-normal, muted-foreground). */
  muted?: boolean;
  /** Filter-toggle link: transparent hover + `text-primary` when `selected`. */
  toggle?: boolean;
  /** Selected filter state (only meaningful with `toggle`). */
  selected?: boolean;
  /** 44px tap target for mobile card rows. */
  tap?: boolean;
}

/**
 * SSOT for the report-table entity-name drill-down link — a ghost `Button`
 * with zero padding. `tap` bumps the touch target to 44px for mobile card rows;
 * `toggle` switches hover to a transparent filter-toggle dialect and, with
 * `selected`, colors the label `text-primary`. Per-site layout classes
 * (`truncate`, `max-w-*`, `font-medium`) override the defaults via tailwind-merge.
 */
export function TableCellLink({
  muted = false,
  toggle = false,
  selected = false,
  tap = false,
  className,
  children,
  ...props
}: TableCellLinkProps): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      // Entity names are operator-entered, so their base direction must come from
      // the content itself rather than from the UI language.
      dir="auto"
      className={cn(
        "h-auto px-0 py-0",
        tap && "min-h-11",
        toggle ? "hover:bg-transparent hover:text-foreground" : "hover:text-primary",
        muted ? "font-normal text-muted-foreground" : "text-sm font-semibold text-foreground",
        selected && "text-primary",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
