import React, { useState, useEffect } from "react";
import { CloudOff, Loader2 } from "lucide-react";
import { getSyncStatus, type SyncStatus } from "@/lib/db";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Displays a compact indicator of the current background server sync status.
 * Hidden when idle. Shows a spinner when syncing and a red badge with tooltip on error.
 */
export function SyncStatusBadge(): React.JSX.Element | null {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SyncStatus>).detail;
      setStatus(detail);
    };
    window.addEventListener("sync-status-change", handler);
    return () => window.removeEventListener("sync-status-change", handler);
  }, []);

  if (status === "idle") return null;

  if (status === "syncing") {
    return (
      <Badge
        pill
        tone="muted"
        aria-label={t("sync.status.syncingAria")}
        className="min-h-11 min-w-11 gap-1.5 px-2.5 font-medium"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        <span className="hidden sm:inline">{t("sync.status.syncing")}</span>
      </Badge>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            pill
            tone="destructive"
            role="alert"
            aria-label={t("sync.status.errorAria")}
            className="min-h-11 min-w-11 cursor-default gap-1.5 px-2.5"
          >
            <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t("sync.status.error")}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{t("sync.status.errorTooltip")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default SyncStatusBadge;
