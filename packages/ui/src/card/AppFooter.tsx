import * as React from "react";
import { cn } from "../utils";

export interface AppFooterProps {
  /** Optional custom footer text (e.g. workspace branding footer). */
  text?: string;
  /** Optional brand/product name used in the default footer. Defaults to "MMS". */
  name?: string;
  /** Optional copyright year. Defaults to current year. */
  year?: number | string;
  className?: string;
}

/**
 * Shared application footer primitive — clean presentation shell for copyright and branding text.
 */
export function AppFooter({
  text,
  name = "MMS",
  year = new Date().getFullYear(),
  className,
}: AppFooterProps): React.JSX.Element {
  return (
    <footer
      className={cn(
        "border-t border-border/50 bg-card/20 px-4 py-3 text-center text-xs font-semibold text-muted-foreground select-none sm:px-6",
        className,
      )}
    >
      {text || `\u00A9 ${year} ${name}. All rights reserved.`}
    </footer>
  );
}
