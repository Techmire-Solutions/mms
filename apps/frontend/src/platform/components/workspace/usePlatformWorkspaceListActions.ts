import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import {
  useSetWorkspaceEmailVerification,
  useSetWorkspaceEnabled,
} from "@/platform/hooks/usePlatformWorkspaces";

export function usePlatformWorkspaceListActions() {
  const setEnabled = useSetWorkspaceEnabled();
  const setEmailVerification = useSetWorkspaceEmailVerification();

  const handleToggleEnabled = (subdomain: string, enabled: boolean): void => {
    setEnabled.mutate({ subdomain, enabled });
  };

  const handleToggleEmailVerification = (
    subdomain: string,
    requireEmailVerification: boolean,
  ): void => {
    setEmailVerification.mutate({ subdomain, requireEmailVerification });
  };

  const handleBulkEnable = (selected: PlatformWorkspaceRowData[]): void => {
    for (const item of selected) {
      if (!item.enabled) setEnabled.mutate({ subdomain: item.subdomain, enabled: true });
    }
  };

  const handleBulkDisable = (selected: PlatformWorkspaceRowData[]): void => {
    for (const item of selected) {
      if (item.enabled) setEnabled.mutate({ subdomain: item.subdomain, enabled: false });
    }
  };

  const togglePending = setEnabled.isPending || setEmailVerification.isPending;

  return {
    handleToggleEnabled,
    handleToggleEmailVerification,
    handleBulkEnable,
    handleBulkDisable,
    togglePending,
  };
}
