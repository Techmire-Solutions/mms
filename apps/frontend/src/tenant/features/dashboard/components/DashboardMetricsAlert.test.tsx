import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardMetricsAlert } from "./DashboardMetricsAlert";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("DashboardMetricsAlert", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("announces the failure politely and retries on demand", async () => {
    const onRetry = vi.fn();
    await act(async () => {
      root.render(
        <DashboardMetricsAlert
          message="Metrics unavailable"
          retryLabel="Retry"
          onRetry={onRetry}
        />,
      );
    });

    expect(container.querySelector("[role='status']")?.textContent).toContain(
      "Metrics unavailable",
    );
    const retry = container.querySelector("button");
    expect(retry?.textContent).toContain("Retry");

    await act(async () => {
      retry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders no action when retry is unavailable", async () => {
    await act(async () => {
      root.render(<DashboardMetricsAlert message="Metrics unavailable" retryLabel="Retry" />);
    });

    expect(container.querySelector("button")).toBeNull();
  });
});
