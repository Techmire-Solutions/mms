import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useObligationsPageController } from "./useObligationsPageController";

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canWrite: true,
    canDelete: true,
    canReports: true,
    canViewSetup: true,
    canEditSetup: true,
  }),
}));

vi.mock("@/tenant/hooks/useModuleTierTabs", () => ({
  useFilteredModuleTierTabs: () => [],
}));

vi.mock("@/hooks/usePersistedTabState", () => ({
  usePersistedTabState: (_key: string, initial: string) => React.useState(initial),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/hooks/useDirectoryTrashState", () => ({
  useDirectoryTrashState: () => React.useState(false),
}));

vi.mock("@/tenant/features/obligations/hooks/useObligationsApi", () => ({
  useObligationsTypesCollection: () => [],
  useObligationsMujtahidsCollection: () => [],
  useObligationsRepsCollection: () => [],
  useObligationsWakalaCollection: () => [],
  useObligationsDistributionsCollection: () => [],
  useObligationsCollections: () => ({ isError: false, refetch: vi.fn() }),
  useObligationsCollectionsCollection: () => [],
  useObligationsMutations: () => ({
    replaceTypes: { mutateAsync: vi.fn() },
    replaceMujtahids: { mutateAsync: vi.fn() },
    replaceReps: { mutateAsync: vi.fn() },
    replaceWakala: { mutateAsync: vi.fn() },
    replaceDistributions: { mutateAsync: vi.fn() },
    replaceCollections: { mutateAsync: vi.fn() },
    deleteCollection: { mutateAsync: vi.fn() },
    restoreCollection: { mutateAsync: vi.fn() },
    bulkDeleteCollections: { mutateAsync: vi.fn() },
    bulkRestoreCollections: { mutateAsync: vi.fn() },
  }),
}));

vi.mock("@/tenant/features/obligations/hooks/useObligationColumnLayout", () => ({
  useObligationColumnLayout: () => ({}),
}));

vi.mock("@/hooks/useMessageComposerState", () => ({
  useMessageComposerState: () => ({
    canWriteMessaging: true,
    messagingTarget: null,
    openComposer: vi.fn(),
    closeComposer: vi.fn(),
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function renderObligationsControllerHook() {
  const result: { current: ReturnType<typeof useObligationsPageController> } = {} as {
    current: ReturnType<typeof useObligationsPageController>;
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function HookHost() {
    result.current = useObligationsPageController();
    return null;
  }

  act(() => {
    root.render(<HookHost />);
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useObligationsPageController selection", () => {
  it("maintains stable clearSelection and handles selection toggling", () => {
    const { result, unmount } = renderObligationsControllerHook();
    try {
      expect(result.current.collectionSelection.selectedIds).toEqual([]);
      const initialClear = result.current.collectionSelection.clearSelection;

      act(() => result.current.collectionSelection.toggleSelected("col-1", true));
      expect(result.current.collectionSelection.selectedIds).toEqual(["col-1"]);
      expect(result.current.collectionSelection.clearSelection).toBe(initialClear);

      act(() => result.current.collectionSelection.toggleSelectAll(true, ["col-1", "col-2"]));
      expect(result.current.collectionSelection.selectedIds).toEqual(["col-1", "col-2"]);

      act(() => result.current.collectionSelection.clearSelection());
      expect(result.current.collectionSelection.selectedIds).toEqual([]);
    } finally {
      unmount();
    }
  });

  it("select-all keeps ids outside the visible page", () => {
    const { result, unmount } = renderObligationsControllerHook();
    try {
      act(() => result.current.collectionSelection.toggleSelected("other", true));
      act(() => result.current.collectionSelection.toggleSelectAll(true, ["col-1", "col-2"]));
      expect(result.current.collectionSelection.selectedIds).toEqual(["other", "col-1", "col-2"]);

      act(() => result.current.collectionSelection.toggleSelectAll(false, ["col-1", "col-2"]));
      expect(result.current.collectionSelection.selectedIds).toEqual(["other"]);
    } finally {
      unmount();
    }
  });

  it("clears collection selection on trash toggle", () => {
    const { result, unmount } = renderObligationsControllerHook();
    try {
      act(() => result.current.collectionSelection.toggleSelected("col-1", true));
      expect(result.current.collectionSelection.selectedIds).toEqual(["col-1"]);

      act(() => result.current.setShowDeleted(true));
      expect(result.current.collectionSelection.selectedIds).toEqual([]);
    } finally {
      unmount();
    }
  });
});
