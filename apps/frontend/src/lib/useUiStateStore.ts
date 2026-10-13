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

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
const pendingUpdates: Record<string, unknown> = {};

export const useUiStateStore = create<UiStateStore>((set, _get) => ({
  state: {},
  isInitialized: false,

  initialize: (initialState: UserUiState) => {
    set({ state: initialState, isInitialized: true });
  },

  updateState: (key: string, value: unknown) => {
    // Optimistic local update
    set((store) => ({
      state: {
        ...store.state,
        [key]: value,
      },
    }));

    // Queue for batch update
    pendingUpdates[key] = value;

    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    debounceTimeout = setTimeout(async () => {
      const updatesToSend = { ...pendingUpdates };
      // Clear pending updates immediately to capture new changes during the async call
      for (const k in updatesToSend) {
        delete pendingUpdates[k];
      }

      try {
        await apiJson(AUTH_PATHS.uiState, {
          method: "PATCH",
          body: JSON.stringify({ state: updatesToSend }),
        });
      } catch (error) {
        reportClientError(error, { context: "uiState.sync" });
        // Note: We could implement a rollback mechanism here if needed
      }
    }, 500); // 500ms debounce
  },
}));

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
