import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { useWorkspaceToday } from "./useWorkspaceToday";

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ timezone: "Pacific/Kiritimati" }),
}));

describe("useWorkspaceToday", () => {
  it("returns the workspace calendar day rather than the device day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    let today = "";
    function Probe(): null {
      today = useWorkspaceToday();
      return null;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<Probe />));
    expect(today).toBe("2026-01-02");
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });
});
