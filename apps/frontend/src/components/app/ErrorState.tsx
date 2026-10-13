import { FeedbackStateLayout } from "./FeedbackStateLayout";
import React from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppTranslationKey } from "@mms/shared";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  type?: "generic" | "network" | "permission";
  compact?: boolean;
  className?: string;
}

/**
 * ErrorState — shown when a data fetch or validation fails.
 */
export const ErrorState = function ErrorState({
  title,
  description,
  onRetry,
  type = "generic",
  compact = false,
  className,
}: ErrorStateProps): React.ReactElement {
  const { t } = useTranslation();

  const configs: Record<
    NonNullable<ErrorStateProps["type"]>,
    { icon: typeof AlertTriangle; color: string; bg: string; titleKey: AppTranslationKey }
  > = {
    generic: {
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      titleKey: "errors.state.generic",
    },
    network: {
      icon: WifiOff,
      color: "text-warning",
      bg: "bg-warning/10",
      titleKey: "errors.state.network",
    },
    permission: {
      icon: AlertTriangle,
      color: "text-warning",
      bg: "bg-warning/10",
      titleKey: "errors.state.permission",
    },
  };

  const stateConfig = configs[type] || configs.generic;
  const Icon = stateConfig.icon;

  return (
    <FeedbackStateLayout
      role="alert"
      title={title || t(stateConfig.titleKey)}
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
            {t("common.tryAgain")}
          </Button>
        )
      }
    />
  );
};
