import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudentLeaderboardSection } from "./StudentLeaderboardSection";
import type { StudentStatItem } from "../lib/performanceAnalyticsUtils";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ExportToolbar", () => ({
  ExportToolbar: ({ title }: { title: string }) => <div data-testid="export-toolbar">{title}</div>,
}));

describe("StudentLeaderboardSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockStats: StudentStatItem[] = [
    {
      name: "Ali Raza",
      class: "Grade 10",
      avg: 92,
      overall: 94,
      scores: [92],
      totalPts: 92,
      maxPts: 100,
    },
    {
      name: "Fatima Noor",
      class: "Grade 10",
      avg: 88,
      overall: 90,
      scores: [88],
      totalPts: 88,
      maxPts: 100,
    },
  ];

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
    vi.clearAllMocks();
  });

  it("returns null when studentStats is empty", async () => {
    await act(async () => {
      root.render(<StudentLeaderboardSection studentStats={[]} />);
    });

    expect(container.innerHTML).toBe("");
  });

  it("renders student leaderboard with rankings, names, classes, and averages", async () => {
    await act(async () => {
      root.render(<StudentLeaderboardSection studentStats={mockStats} />);
    });

    expect(container.textContent).toContain("questionBank.analytics.studentLeaderboard");
    expect(container.textContent).toContain("Ali Raza");
    expect(container.textContent).toContain("Grade 10");
    expect(container.textContent).toContain("92%");
    expect(container.textContent).toContain("Fatima Noor");
    expect(container.textContent).toContain("88%");

    const toolbar = container.querySelector("[data-testid='export-toolbar']");
    expect(toolbar).toBeDefined();
    expect(toolbar?.textContent).toBe("questionBank.analytics.studentLeaderboard");
  });
});
