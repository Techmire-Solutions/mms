import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useContactsToolbarModel, type ContactsListFiltersModel } from "./useContactsToolbarModel";
import { DEFAULT_COLUMN_REGISTRY, type AppTranslationKey } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUpdateUserColumnLayout = vi.fn();

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    availableColumns: [
      { key: "name", label: "Name", sortField: "name" },
      { key: "custom_score", label: "Score", sortField: "score" },
      { key: "avatar", label: "Photo" },
    ],
    genders: ["male", "female", "other"],
    systemSortOptions: [
      { field: "name", label: "Name (A-Z)" },
      { field: "createdAt", label: "Recently Added" },
    ],
    columnRegistry: DEFAULT_COLUMN_REGISTRY,
    updateUserColumnLayout: mockUpdateUserColumnLayout,
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: AppTranslationKey, params?: Record<string, string | number>) => {
      const map: Partial<Record<AppTranslationKey, string>> = {
        "contacts.columns": "Columns",
        "contacts.visibleAndOrder": "Visible & Order",
        "contacts.hidden": "Hidden",
        "contacts.fixed": "Fixed",
        "contacts.hideColumn": `Hide ${params?.label ?? ""}`,
        "contacts.resetLayout": "Reset Layout",
        "contacts.searchColumnsPlaceholder": "Search columns...",
      };
      return map[key] ?? key;
    },
  }),
}));

let hookResult: ContactsListFiltersModel | null = null;

function TestComponent(): React.JSX.Element {
  const model = useContactsToolbarModel();
  hookResult = model;
  return <div />;
}

async function mount() {
  const root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(<TestComponent />);
  });
  return { root };
}

describe("useContactsToolbarModel Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookResult = null;
  });

  it("merges dynamic column sorts and system sort options without duplicates, omitting unsortable columns", async () => {
    const { root } = await mount();

    expect(hookResult?.sortOptions).toEqual([
      { field: "name", label: "Name" },
      { field: "score", label: "Score" },
      { field: "createdAt", label: "Recently Added" },
    ]);
    expect(hookResult?.sortOptions.some((s) => s.label === "Photo")).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("exposes genders and columnRegistry from contact config", async () => {
    const { root } = await mount();

    expect(hookResult?.genders).toEqual(["male", "female", "other"]);
    expect(hookResult?.columnRegistry).toEqual(DEFAULT_COLUMN_REGISTRY);

    await act(async () => {
      root.unmount();
    });
  });

  it("generates column customizer labels correctly", async () => {
    const { root } = await mount();

    expect(hookResult?.columnCustomizerLabels.trigger).toBe("Columns");
    expect(hookResult?.columnCustomizerLabels.hideColumn("Phone")).toBe("Hide Phone");

    await act(async () => {
      root.unmount();
    });
  });

  it("invokes updateUserColumnLayout with DEFAULT_COLUMN_REGISTRY on reset", async () => {
    const { root } = await mount();

    hookResult?.handleResetColumnLayout();
    expect(mockUpdateUserColumnLayout).toHaveBeenCalledWith(DEFAULT_COLUMN_REGISTRY);

    await act(async () => {
      root.unmount();
    });
  });
});
