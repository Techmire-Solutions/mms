import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MigrateAndRestartAccepted, PlatformSettings } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";

/** Default delay before migrate starts when the response omits delayMs. */
const DEFAULT_MIGRATE_RESTART_DELAY_MS = 1_500;

/** How long to wait for `/ready` after migrate+reload before forcing a soft reload. */
const READY_POLL_TIMEOUT_MS = 60_000;

/** Interval between `/ready` probes while waiting for the backend. */
const READY_POLL_INTERVAL_MS = 750;

import { PLATFORM_SETTINGS_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

export { PLATFORM_SETTINGS_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function updateSettingsCache(old: unknown, newSettings: PlatformSettings): unknown {
  if (!old || typeof old !== "object") return old;
  const asTsr = old as { body?: { settings?: PlatformSettings } };
  if (asTsr.body && typeof asTsr.body === "object") {
    return {
      ...asTsr,
      body: {
        ...asTsr.body,
        settings: newSettings,
      },
    };
  }
  return newSettings;
}

/**
 * Wait for the backend delay window, then poll `/ready` until OK (or timeout).
 * Preserves the platform session — callers should soft-reload, not log out.
 */
export async function waitForBackendReadyAfterMigrate(delayMs: number): Promise<void> {
  const waitMs =
    Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : DEFAULT_MIGRATE_RESTART_DELAY_MS;
  await sleep(waitMs);

  const deadline = Date.now() + READY_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await apiContract.health.ready({});
      if (response.status === 200) return;
    } catch {
      // Backend still restarting — keep polling.
    }
    await sleep(READY_POLL_INTERVAL_MS);
  }
}

export function usePlatformSettingsQuery() {
  const { isPlatformAuthenticated, canSettings } = usePlatformPermissions();

  const query = useQuery({
    queryKey: PLATFORM_SETTINGS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platform.getSettings({ signal, fetchOptions: { signal } });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load platform settings",
          errorBody?.type,
        );
      }
      return (response.body as { settings: PlatformSettings }).settings;
    },
    enabled: isPlatformAuthenticated && canSettings,
    staleTime: 60_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** Hook for platform super-users to update global platform settings. */
export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (patch: Partial<PlatformSettings>) => {
      const res = await apiContract.platform.updateSettings({ body: patch });
      return res.body as { settings: PlatformSettings; success: boolean };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(PLATFORM_SETTINGS_QUERY_KEY, (old) =>
        updateSettingsCache(old, data.settings),
      );
      void queryClient.invalidateQueries({ queryKey: PLATFORM_SETTINGS_QUERY_KEY });
    },
    onError: (err) => {
      notify.error(getPlatformErrorMessage(err, t));
    },
  });
}

/** Hook for platform super-users to apply Drizzle migrations and reload the backend. */
export function useMigrateAndRestartPlatform() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (input: { confirm: string; password: string }) => {
      const res = await apiContract.platform.migrateAndRestart({ body: input });
      return res.body as MigrateAndRestartAccepted;
    },
    onSuccess: () => {
      notify.success(t("platform.profileMigrateRestartSuccess"));
    },
    onError: (err) => {
      notify.error(getPlatformErrorMessage(err, t));
    },
  });
}
