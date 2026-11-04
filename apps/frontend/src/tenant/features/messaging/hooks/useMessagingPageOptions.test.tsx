import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useMessagingPageOptions } from "./useMessagingPageOptions";

const { stableT } = vi.hoisted(() => ({ stableT: (key: string) => key }));

// A stable translator identity keeps the memo dependency honest across renders.
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: stableT }),
}));

describe("useMessagingPageOptions", () => {
  it("renders an in-flight badge for claimed rows", () => {
    let options: ReturnType<typeof useMessagingPageOptions> | null = null;

    function Host() {
      options = useMessagingPageOptions();
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<Host />);
    });

    expect(options!.logStatusConfig.sending).toEqual(
      expect.objectContaining({ label: "messaging.status.sending" }),
    );
    expect(options!.logStatusConfig.sent?.label).toBe("messaging.status.sent");
    // Derived arrays are memoized: the identity must be stable across renders.
    const first = options!.categorySelectOptions;
    act(() => {
      root.render(<Host />);
    });
    expect(options!.categorySelectOptions).toBe(first);

    act(() => root.unmount());
  });
});
