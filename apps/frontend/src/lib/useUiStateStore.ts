import { create } from "zustand";
import type { UserUiState } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
import { AUTH_PATHS } from "@/lib/apiClientHelpers";
import { reportClientError } from "@/lib/clientErrorReporting";

interface UiStateStore {
  state: UserUiState;
  isInitialized: boolean;
  initialize: (initialState: UserUiState) => void;
  updateState: (key: string, value: unknown) => void;
}

/**
 * Debounce window applied per key. Each preference syncs independently so a fast
 * toggle on one key never flushes — or rolls back — unrelated keys.
 */
const SYNC_DEBOUNCE_MS = 500;

export const useUiStateStore = create<UiStateStore>((set) => {
  /** Last value confirmed by the server, per key — the rollback target on failure. */
  let confirmedState: UserUiState = {};
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const syncKey = async (key: string, value: unknown): Promise<void> => {
    pendingTimers.delete(key);
    try {
      await apiJson(AUTH_PATHS.uiState, {
        method: "PATCH",
        body: JSON.stringify({ state: { [key]: value } }),
      });
      confirmedState = { ...confirmedState, [key]: value };
    } catch (error) {
      reportClientError(error, { context: "uiState.sync" });
      // Roll back to the last server-confirmed value, but only if the current
      // value is still the one that failed (a newer edit may already be queued).
      set((store) => {
        if (store.state[key] !== value) return {};
        const nextState = { ...store.state };
        if (Object.prototype.hasOwnProperty.call(confirmedState, key)) {
          nextState[key] = confirmedState[key];
        } else {
          delete nextState[key];
        }
        return { state: nextState };
      });
    }
  };

  return {
    state: {},
    isInitialized: false,

    initialize: (initialState: UserUiState) => {
      for (const timer of pendingTimers.values()) clearTimeout(timer);
      pendingTimers.clear();
      confirmedState = { ...initialState };
      set({ state: initialState, isInitialized: true });
    },

    updateState: (key: string, value: unknown) => {
      // Optimistic local update
      set((store) => ({ state: { ...store.state, [key]: value } }));

      // Per-key debounce: reset only this key's timer.
      const existingTimer = pendingTimers.get(key);
      if (existingTimer) clearTimeout(existingTimer);
      pendingTimers.set(
        key,
        setTimeout(() => {
          void syncKey(key, value);
        }, SYNC_DEBOUNCE_MS),
      );
    },
  };
});

// Utility hook for individual keys
export function useUiPreference<T>(key: string, defaultValue: T): [T, (val: T) => void] {
  const _isInitialized = useUiStateStore((s) => s.isInitialized);
  const value = useUiStateStore((s) =>
    s.state[key] !== undefined ? s.state[key] : defaultValue,
  ) as T;
  const updateState = useUiStateStore((s) => s.updateState);

  const setValue = (newVal: T) => {
    updateState(key, newVal);
  };

  // If not initialized yet, we return the default, but we should not crash.
  // The caller needs to decide if they should render a skeleton, or just use default.
  return [value, setValue];
}
