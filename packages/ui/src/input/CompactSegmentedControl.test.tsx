import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompactSegmentedControl } from "./CompactSegmentedControl";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SIX_OPTIONS = [
  { value: "all", label: "ALL STUDENTS" },
  { value: "added", label: "ADDED IN LAST 30 DAYS" },
  { value: "missing", label: "MISSING GR NUMBER" },
  { value: "active", label: "ACTIVE" },
  { value: "graduated", label: "GRADUATED" },
  { value: "transferred", label: "TRANSFERRED" },
] as const;

describe("CompactSegmentedControl", () => {
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
    vi.restoreAllMocks();
  });

  it("keeps tray options at their intrinsic width and makes the tray the scroller", async () => {
    // Regression guard for the 2026-10-31 review: six presets at 375px had
    // labels 45–57px wide for 62–108px of text, so they superimposed.
    await act(async () => {
      root.render(
        <CompactSegmentedControl options={SIX_OPTIONS} value="all" onChange={() => {}} />,
      );
    });

    const group = container.querySelector<HTMLElement>('[role="group"]');
    expect(group).not.toBeNull();
    expect(group?.className).toContain("overflow-x-auto");

    const buttons = Array.from(group?.querySelectorAll("button") ?? []);
    expect(buttons).toHaveLength(SIX_OPTIONS.length);
    for (const button of buttons) {
      expect(button.className).toMatch(/(^|\s)shrink-0(\s|$)/);
      expect(button.className).not.toMatch(/(^|\s)flex-1(\s|$)/);
    }
  });

  it("uses equal-width fill instead of shrink-0 when requested", async () => {
    await act(async () => {
      root.render(
        <CompactSegmentedControl options={SIX_OPTIONS} value="all" onChange={() => {}} fill />,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    for (const button of buttons) {
      expect(button.className).toMatch(/(^|\s)flex-1(\s|$)/);
      expect(button.className).not.toMatch(/(^|\s)shrink-0(\s|$)/);
    }
  });

  it("wraps chips instead of shrinking when the chips layout is used", async () => {
    await act(async () => {
      root.render(
        <CompactSegmentedControl
          options={SIX_OPTIONS}
          value="all"
          onChange={() => {}}
          layout="chips"
        />,
      );
    });

    const group = container.querySelector<HTMLElement>('[role="group"]');
    expect(group?.className).toContain("flex-wrap");
    expect(group?.className).not.toContain("overflow-x-auto");
  });
});
