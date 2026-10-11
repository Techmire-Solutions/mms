import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BulkSelectionStatusAction } from "./BulkSelectionStatusAction";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("BulkSelectionStatusAction", () => {
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

  it("renders status trigger button with label", async () => {
    const handleSelectStatus = vi.fn();
    const config = {
      active: { label: "Active", tone: "success" as const, cls: "bg-success/10 text-success" },
      inactive: {
        label: "Inactive",
        tone: "neutral" as const,
        cls: "bg-muted text-muted-foreground",
      },
    };

    await act(async () => {
      root.render(
        <BulkSelectionStatusAction
          label="Change Status"
          statuses={["active", "inactive"]}
          statusBadgeConfig={config}
          onSelectStatus={handleSelectStatus}
        />,
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Change Status");
  });
});
