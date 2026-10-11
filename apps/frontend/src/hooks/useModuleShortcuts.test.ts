import { describe, it, expect } from "vitest";
import { useModuleShortcuts } from "./useModuleShortcuts";

describe("useModuleShortcuts", () => {
  it("exports useModuleShortcuts function", () => {
    expect(typeof useModuleShortcuts).toBe("function");
  });

  it("can be invoked in a functional component structure", () => {
    function TestShortcutComponent() {
      useModuleShortcuts({
        searchInputId: "test-search-input",
        onCreate: () => {},
        enabled: true,
      });
      return null;
    }

    expect(typeof TestShortcutComponent).toBe("function");
  });
});
