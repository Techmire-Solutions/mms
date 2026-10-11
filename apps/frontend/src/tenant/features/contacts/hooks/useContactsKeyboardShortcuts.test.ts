import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useContactsKeyboardShortcuts,
  CONTACTS_WORK_SEARCH_INPUT_ID,
  type UseContactsKeyboardShortcutsOptions,
} from "./useContactsKeyboardShortcuts";
import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";

vi.mock("@/hooks/useModuleShortcuts", () => ({
  useModuleShortcuts: vi.fn(),
}));

describe("useContactsKeyboardShortcuts Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards CONTACTS_WORK_SEARCH_INPUT_ID and options to useModuleShortcuts", () => {
    const clearFilters = vi.fn();
    const clearSelection = vi.fn();
    const onCreate = vi.fn();

    const options: UseContactsKeyboardShortcutsOptions = {
      selectedCount: 3,
      hasActiveFilters: true,
      clearFilters,
      clearSelection,
      canWrite: true,
      viewingDeleted: false,
      onCreate,
    };

    useContactsKeyboardShortcuts(options);

    expect(useModuleShortcuts).toHaveBeenCalledWith({
      searchInputId: CONTACTS_WORK_SEARCH_INPUT_ID,
      selectedCount: 3,
      hasActiveFilters: true,
      clearFilters,
      clearSelection,
      canWrite: true,
      showDeleted: false,
      onCreate,
    });
  });

  it("maps viewingDeleted=true to showDeleted=true and preserves read-only canWrite=false", () => {
    const clearFilters = vi.fn();
    const clearSelection = vi.fn();
    const onCreate = vi.fn();

    useContactsKeyboardShortcuts({
      selectedCount: 0,
      hasActiveFilters: false,
      clearFilters,
      clearSelection,
      canWrite: false,
      viewingDeleted: true,
      onCreate,
    });

    expect(useModuleShortcuts).toHaveBeenCalledWith(
      expect.objectContaining({
        showDeleted: true,
        canWrite: false,
      }),
    );
  });
});
