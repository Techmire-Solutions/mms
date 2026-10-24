import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface RouteStatusFallbackProps {
  /** Use full viewport height (boot gates) vs in-route Suspense fallback. */
  fullScreen?: boolean;
}

/** Accessible loading state for route boot gates and redirects. */
export default function RouteStatusFallback({
  fullScreen = true,
}: RouteStatusFallbackProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className={`flex items-center justify-center bg-background ${fullScreen ? "min-h-screen" : "min-h-viewport-half w-full"}`}
      role="status"
      aria-live="polite"
    >
      <svg
        className="h-8 w-8 animate-spin text-primary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
}
