import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  PlatformBackupExportInput,
  PlatformBackupExportResponse,
  PlatformBackupImportInput,
  PlatformConfigBackupApplyResult,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";
import { PLATFORM_QUERY_KEYS } from "@/platform/features/shell/lib/platformQueryKeys";
import { hydratePlatformBranding } from "@/lib/branding/platformBrandingStore";

export function useExportPlatformBackup() {
  return useMutation({
    mutationFn: async (input: PlatformBackupExportInput): Promise<PlatformBackupExportResponse> => {
      const res = await apiContract.platform.exportBackup({ body: input });
      assertContractOk(res, "Failed to export platform backup");
      return res.body as PlatformBackupExportResponse;
    },
  });
}

export function useImportPlatformBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: PlatformBackupImportInput,
    ): Promise<PlatformConfigBackupApplyResult> => {
      const res = await apiContract.platform.importBackup({ body: input });
      assertContractOk(res, "Failed to import platform backup");
      return res.body as PlatformConfigBackupApplyResult;
    },
    onSuccess: (result) => {
      if (result.applied.branding || result.applied.settings) {
        void queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.branding });
        void queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.settings });
        void queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.moduleCatalog });
        void hydratePlatformBranding(true);
      }
    },
  });
}
