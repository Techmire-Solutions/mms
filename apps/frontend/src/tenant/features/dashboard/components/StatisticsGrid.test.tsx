import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { StatisticsGrid } from "./StatisticsGrid";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("StatisticsGrid", () => {
  it("shows placeholders instead of zero-valued cards during the initial load", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StatisticsGrid
          isLoading
          statItems={[
            {
              id: "students",
              title: "Students",
              value: "0",
              sub: "Registered students",
              icon: "users",
              color: "emerald",
              trend: 0,
            },
          ]}
        />,
      );
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
    expect(container.textContent).not.toContain("Students");
    expect(container.textContent).not.toContain("0");

    await act(async () => {
      root.unmount();
    });
  });
});
