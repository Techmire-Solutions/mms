import React from "react";
import {
  AppFooter as SharedAppFooter,
  type AppFooterProps as SharedAppFooterProps,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";

export type AppFooterProps = SharedAppFooterProps;

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Shared application footer facade — wraps @shared/ui AppFooter with
 * localized product and copyright defaults via useTranslation().
 */
export function AppFooter({ text, name, className, ...rest }: AppFooterProps): React.JSX.Element {
  const { t } = useTranslation();
  const resolvedText =
    text ||
    t("theme.footerDefault", {
      year: String(CURRENT_YEAR),
      name: name ?? t("entry.productName"),
    });

  return <SharedAppFooter text={resolvedText} name={name} className={className} {...rest} />;
}
