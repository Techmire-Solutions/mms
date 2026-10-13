import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

export interface SkipToContentLinkProps {
  /** Target element id. Defaults to the app shell's `<main id="main-content">`. */
  targetId?: string;
}

/**
 * Visually hidden until focused, then pinned to the top-start corner.
 *
 * Both authenticated shells (tenant and platform) render a long sidebar, so a
 * keyboard user needs a way past it on every navigation — WCAG 2.4.1 (Bypass
 * Blocks). The platform shell had this; the tenant shell, which is the surface
 * every madrasa user actually opens, did not.
 *
 * Uses logical `start-3` so it lands on the correct side in ar/ur/fa.
 */
export function SkipToContentLink({
  targetId = "main-content",
}: SkipToContentLinkProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-toast focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-xl focus:shadow-xl focus:outline-none text-xs font-bold"
    >
      {t("common.skipToContent")}
    </a>
  );
}
