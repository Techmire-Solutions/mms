import React, { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

export type NetworkState = "online" | "offline" | "reconnecting";

export interface NetworkStatusIndicatorProps {
  className?: string;
}

/**
 * Floating network status indicator compliant with MMS UI/UX tokens.
 * Displays offline banners, reconnecting status, and recovery confirmations without hardcoded colors.
 */
export function NetworkStatusIndicator({
  className,
}: NetworkStatusIndicatorProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [networkState, setNetworkState] = useState<NetworkState>(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return "offline";
    }
    return "online";
  });

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let dismissTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOffline = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (dismissTimer) clearTimeout(dismissTimer);
      setNetworkState("offline");
      setVisible(true);
    };

    const handleOnline = () => {
      setNetworkState("reconnecting");
      setVisible(true);

      reconnectTimer = setTimeout(() => {
        setNetworkState("online");
        dismissTimer = setTimeout(() => {
          setVisible(false);
        }, 2000);
      }, 1500);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (!navigator.onLine) {
      setNetworkState("offline");
      setVisible(true);
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, []);

  if (!visible && networkState === "online") {
    return null;
  }

  return (
    <aside
      aria-live="polite"
      aria-atomic="true"
      role="status"
      className={cn(
        "fixed bottom-5 inset-x-0 z-50 flex justify-center pointer-events-none px-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium shadow-md backdrop-blur-md transition-colors",
          networkState === "offline" &&
            "bg-destructive/15 text-destructive border border-destructive/25 dark:bg-destructive/15",
          networkState === "reconnecting" &&
            "bg-warning/15 text-warning border border-warning/25 dark:bg-warning/15",
          networkState === "online" &&
            "bg-success/15 text-success border border-success/25 dark:bg-success/15",
        )}
      >
        {networkState === "offline" && (
          <>
            <WifiOff
              className="h-3.5 w-3.5 shrink-0 animate-pulse text-destructive"
              aria-hidden="true"
            />
            <span>{t("network.offlineBanner")}</span>
          </>
        )}
        {networkState === "reconnecting" && (
          <>
            <RefreshCw
              className="h-3.5 w-3.5 shrink-0 animate-spin text-warning"
              aria-hidden="true"
            />
            <span>{t("network.reconnectingBanner")}</span>
          </>
        )}
        {networkState === "online" && (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            <span>{t("network.onlineRestored")}</span>
          </>
        )}
      </div>
    </aside>
  );
}
