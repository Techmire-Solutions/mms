import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useFilteredModuleTierTabs,
  useModuleTierTabs,
  type ModuleTierTab,
} from "./useModuleTierTabs";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: "en",
    isLoading: false,
    dir: "ltr" as const,
    isRtl: false,
  }),
}));

describe("useModuleTierTabs", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("labels the primary operational tab with workLabelKey", async () => {
    let tabs: ModuleTierTab[] | null = null;

    function TestComponent() {
      tabs = useModuleTierTabs({ workLabelKey: "nav.students" });
      return null;
    }

    await act(async () => {
      createRoot(container!).render(React.createElement(TestComponent));
    });

    expect(tabs).not.toBeNull();
    expect(tabs![0]).toMatchObject({
      id: "work",
      label: "nav.students",
      description: "module.workHint",
    });
    expect(tabs![1]?.id).toBe("reports");
    expect(tabs![2]?.id).toBe("setup");
  });

  it("filters Reports/Setup by capability and keeps workLabelKey", async () => {
    let tabs: ModuleTierTab[] | null = null;

    function TestComponent() {
      tabs = useFilteredModuleTierTabs({
        workLabelKey: "nav.contacts",
        canViewSetup: false,
        canViewReports: true,
      });
      return null;
    }

    await act(async () => {
      createRoot(container!).render(React.createElement(TestComponent));
    });

    expect(tabs).not.toBeNull();
    expect(tabs!.map((tab) => tab.id)).toEqual(["work", "reports"]);
    expect(tabs![0]?.label).toBe("nav.contacts");
  });
});
