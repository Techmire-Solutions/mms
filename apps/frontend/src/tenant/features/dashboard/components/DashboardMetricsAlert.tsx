import React from "react";
import { Button } from "@/components/ui/button";

interface DashboardMetricsAlertProps {
  message: string;
  retryLabel: string;
  onRetry?: () => void;
}

/**
 * Inline recovery row for a failed composite-metrics request. Cards fall back to
 * "unavailable"; without this the dashboard offered no way back (2026-11-04 UI
 * review).
 */
export function DashboardMetricsAlert({
  message,
  retryLabel,
  onRetry,
}: DashboardMetricsAlertProps): React.JSX.Element {
  return (
    <div
      role="status"
      className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5"
    >
      <p className="m-0 text-xs font-semibold text-foreground">{message}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 cursor-pointer text-xs"
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
