import React from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface AppFooterProps {
  /** Optional custom footer text (e.g. workspace branding footer). Falls back to the product default. */
  text?: string;
  /** Optional brand/product name used in the default footer. Defaults to the product name. */
  name?: string;
  className?: string;
}

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Shared application footer — used by both the tenant app shell and the platform
 * console so the footer markup stays DRY across surfaces.
 */
export function AppFooter({ text, name, className }: AppFooterProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <footer
      className={cn(
        "border-t border-border/50 bg-card/20 px-4 py-3 text-center text-xs font-semibold text-muted-foreground select-none sm:px-6",
        className,
      )}
    >
      {text ||
        t("theme.footerDefault", {
          year: String(CURRENT_YEAR),
          name: name ?? t("entry.productName"),
        })}
    </footer>
  );
}
