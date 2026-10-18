import type React from "react";
import { usePlatformSessionTimeout } from "@/platform/hooks/usePlatformSessionTimeout";

export interface PlatformSessionTimeoutWatcherProps {
  enabled: boolean;
  onTimeout: () => void;
  onExtend: () => Promise<void>;
  busy: boolean;
}

export function PlatformSessionTimeoutWatcher({
  enabled,
  onTimeout,
  onExtend,
  busy,
}: PlatformSessionTimeoutWatcherProps): React.JSX.Element | null {
  return usePlatformSessionTimeout({
    enabled,
    onTimeout,
    onExtend,
    busy,
  });
}
