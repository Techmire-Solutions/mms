import React from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { LoadingState } from "./LoadingState";
import { Button } from "../button/Button";
import { cn } from "../utils";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  type?: "generic" | "network" | "permission";
  compact?: boolean;
  className?: string;
}

const DEFAULT_TITLES = {
  generic: "Something went wrong",
  network: "Connection issue",
  permission: "Access restricted",
} as const;

/**
 * Universal ErrorState component — shown when a data fetch or operation fails.
 */
export function ErrorState({
  title,
  description,
  retryLabel = "Try again",
  onRetry,
  type = "generic",
  compact = false,
  className,
}: ErrorStateProps): React.JSX.Element {
  const configs = {
    generic: {
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      title: DEFAULT_TITLES.generic,
    },
    network: {
      icon: WifiOff,
      color: "text-warning",
      bg: "bg-warning/10",
      title: DEFAULT_TITLES.network,
    },
    permission: {
      icon: AlertTriangle,
      color: "text-warning",
      bg: "bg-warning/10",
      title: DEFAULT_TITLES.permission,
    },
  };

  const stateConfig = configs[type] || configs.generic;
  const Icon = stateConfig.icon;

  return (
    <LoadingState
      role="alert"
      title={title || stateConfig.title}
      description={description}
      compact={compact}
      className={className}
      icon={
        <div
          className={cn(
            stateConfig.bg,
            "rounded-2xl flex items-center justify-center mb-4",
            compact ? "w-10 h-10" : "w-14 h-14",
          )}
        >
          <Icon
            className={cn(stateConfig.color, compact ? "w-5 h-5" : "w-7 h-7")}
            aria-hidden="true"
          />
        </div>
      }
      action={
        onRetry && (
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            className="flex min-h-11 items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {retryLabel}
          </Button>
        )
      }
    />
  );
}
