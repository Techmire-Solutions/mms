import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import { useModuleSettingsEditor } from "./useModuleSettingsEditor";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useModuleSettingsEditor", () => {
  it("does not cause infinite re-renders when settings reference churns with same content", async () => {
    let renderCount = 0;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function TestComponent() {
      renderCount++;
      const [tick, setTick] = useState(0);

      // Settings object that gets a new reference on every render
      const settings = {
        enabledTabs: ["general"],
        tick,
      };

      const { settingsDraft } = useModuleSettingsEditor({
        config: {
          settings,
          updateSettings: vi.fn(),
        },
      });

      return (
        <div>
          <span data-testid="draft">{settingsDraft.enabledTabs?.join(",")}</span>
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            Trigger Render
          </button>
        </div>
      );
    }

    await act(async () => {
      root.render(<TestComponent />);
    });

    // Should mount cleanly without exceeding update depth
    expect(renderCount).toBeLessThan(5);
    expect(container.textContent).toContain("general");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("updates draft and allows discarding drafts", async () => {
    let hookResult!: ReturnType<typeof useModuleSettingsEditor>;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const initialSettings = {
      enabledTabs: ["general"],
    };

    function TestComponent() {
      hookResult = useModuleSettingsEditor({
        config: {
          settings: initialSettings,
          updateSettings: vi.fn(),
        },
      });
      return null;
    }

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(hookResult.settingsDraft).toEqual(initialSettings);

    await act(async () => {
      hookResult.upd("enabledTabs", ["general", "advanced"]);
    });

    expect(hookResult.settingsDraft.enabledTabs).toEqual(["general", "advanced"]);

    await act(async () => {
      hookResult.discardDrafts();
    });

    expect(hookResult.settingsDraft.enabledTabs).toEqual(["general"]);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
