import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StatisticsGrid } from "./StatisticsGrid";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const studentCard = {
  id: "students",
  title: "Students",
  value: "1441",
  sub: "Registered students",
  icon: "users",
  color: "emerald",
  trend: 3,
};

describe("StatisticsGrid", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows placeholders instead of zero-valued cards during the initial load", async () => {
    await act(async () => {
      root.render(<StatisticsGrid isLoading statItems={[{ ...studentCard, value: "0" }]} />);
    });

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
    expect(container.textContent).not.toContain("Students");
    expect(container.textContent).not.toContain("0");
    // Pending metrics are announced as busy and the skeleton blocks stay hidden.
    expect(container.querySelector("section")?.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll("[aria-hidden='true']").length).toBeGreaterThanOrEqual(4);
  });

  it("renders an unavailable card as a dash instead of a fabricated zero", async () => {
    await act(async () => {
      root.render(
        <StatisticsGrid statItems={[{ ...studentCard, value: "", trend: 0, unavailable: true }]} />,
      );
    });

    expect(container.textContent).toContain("Students");
    expect(container.textContent).toContain("—");
    expect(container.textContent).not.toContain("1441");
  });

  it("renders a real value for an available card", async () => {
    await act(async () => {
      root.render(<StatisticsGrid statItems={[studentCard]} />);
    });

    expect(container.textContent).toContain("1441");
    expect(container.textContent).not.toContain("—");
  });

  it("keeps the document outline sequential: h2 section, h3 card titles", async () => {
    await act(async () => {
      root.render(<StatisticsGrid statItems={[studentCard]} />);
    });

    expect(container.querySelector("section h2")).not.toBeNull();
    const cardHeading = container.querySelector("h3");
    expect(cardHeading?.textContent).toBe("Students");
    expect(container.querySelector("h4")).toBeNull();
  });

  it("hides the restore action when the caller cannot write", async () => {
    await act(async () => {
      root.render(<StatisticsGrid statItems={[]} />);
    });

    expect(container.textContent).not.toContain("dashboard.resetCards");

    await act(async () => {
      root.render(<StatisticsGrid statItems={[]} onResetCards={() => {}} />);
    });
    expect(container.textContent).toContain("dashboard.resetCards");
  });
});
