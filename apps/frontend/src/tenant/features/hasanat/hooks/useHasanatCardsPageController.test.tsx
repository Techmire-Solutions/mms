import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useHasanatCardsPageController } from "./useHasanatCardsPageController";

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

vi.mock("@/tenant/features/hasanat/hooks/useHasanatApi", () => ({
  useHasanatDenoms: () => ({ data: { body: [] } }),
  useHasanatBatches: () => ({ data: { body: [] } }),
  useHasanatDistributions: () => ({ data: { body: [] }, isError: false, refetch: vi.fn() }),
  useHasanatMutations: () => ({
    replaceDenoms: { mutateAsync: vi.fn() },
    replaceBatches: { mutateAsync: vi.fn() },
    createDistribution: { mutateAsync: vi.fn() },
    updateDistribution: { mutateAsync: vi.fn() },
    deleteDistribution: { mutateAsync: vi.fn() },
    restoreDistribution: { mutateAsync: vi.fn() },
    bulkDeleteDistributions: { mutateAsync: vi.fn() },
    bulkRestoreDistributions: { mutateAsync: vi.fn() },
  }),
}));

vi.mock("@/tenant/features/hasanat/hooks/useHasanatDistributionColumnLayout", () => ({
  useHasanatDistributionColumnLayout: () => ({}),
}));

vi.mock("@/tenant/features/hasanat/hooks/useHasanatRedemptionColumnLayout", () => ({
  useHasanatRedemptionColumnLayout: () => ({}),
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

function renderHasanatControllerHook() {
  const result: { current: ReturnType<typeof useHasanatCardsPageController> } = {} as {
    current: ReturnType<typeof useHasanatCardsPageController>;
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function HookHost() {
    result.current = useHasanatCardsPageController();
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

describe("useHasanatCardsPageController selection", () => {
  it("owns distribution selection and wires real values into shortcuts", () => {
    const { result, unmount } = renderHasanatControllerHook();
    try {
      act(() => result.current.distributionSelection.toggleSelected("dist-1", true));
      expect(result.current.distributionSelection.selectedIds).toEqual(["dist-1"]);
      act(() => result.current.setShowDeleted(true));
      expect(result.current.distributionSelection.selectedIds).toEqual([]);
    } finally {
      unmount();
    }
  });

  it("select-all keeps ids outside the visible page", () => {
    const { result, unmount } = renderHasanatControllerHook();
    try {
      act(() => result.current.distributionSelection.toggleSelected("other", true));
      act(() => result.current.distributionSelection.toggleSelectAll(true, ["a", "b"]));
      expect(result.current.distributionSelection.selectedIds).toEqual(["other", "a", "b"]);
    } finally {
      unmount();
    }
  });
});
