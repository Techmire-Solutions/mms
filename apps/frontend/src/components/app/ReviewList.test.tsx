import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReviewList } from "./ReviewList";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ReviewList", () => {
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

  it("renders divided items with labels, values, and actions", async () => {
    await act(async () => {
      root.render(
        <ReviewList
          items={[
            { label: "Account", value: "1000 — Cash" },
            {
              label: "Amount",
              value: "$100.00",
              action: <button type="button">Edit</button>,
            },
          ]}
        />,
      );
    });

    expect(container.textContent).toContain("Account");
    expect(container.textContent).toContain("1000 — Cash");
    expect(container.textContent).toContain("Amount");
    expect(container.textContent).toContain("$100.00");
    expect(container.querySelector("button")?.textContent).toBe("Edit");
  });

  it("renders compact items variant", async () => {
    await act(async () => {
      root.render(
        <ReviewList
          variant="compact"
          items={[
            { label: "Subdomain", value: "demo" },
            { label: "Name", value: "Demo Madrasa" },
          ]}
        />,
      );
    });

    expect(container.textContent).toContain("Subdomain:");
    expect(container.textContent).toContain("demo");
    expect(container.textContent).toContain("Name:");
    expect(container.textContent).toContain("Demo Madrasa");
  });
});
