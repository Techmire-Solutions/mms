import { describe, expect, it } from "vitest";
import { resolveMarksGridTarget } from "./marksGridNavigation";

describe("resolveMarksGridTarget", () => {
  it("moves down with Enter and ArrowDown and stops at the last row", () => {
    expect(resolveMarksGridTarget(0, "Enter", false, 3)).toBe(1);
    expect(resolveMarksGridTarget(1, "ArrowDown", false, 3)).toBe(2);
    expect(resolveMarksGridTarget(2, "ArrowDown", false, 3)).toBe(2);
    expect(resolveMarksGridTarget(2, "Enter", false, 3)).toBe(2);
  });

  it("moves up with ArrowUp and stops at the first row", () => {
    expect(resolveMarksGridTarget(2, "ArrowUp", false, 3)).toBe(1);
    expect(resolveMarksGridTarget(0, "ArrowUp", false, 3)).toBe(0);
  });

  it("tabs forward/backward but lets Tab leave the grid at an edge", () => {
    expect(resolveMarksGridTarget(0, "Tab", false, 3)).toBe(1);
    expect(resolveMarksGridTarget(2, "Tab", false, 3)).toBeNull();
    expect(resolveMarksGridTarget(1, "Tab", true, 3)).toBe(0);
    expect(resolveMarksGridTarget(0, "Tab", true, 3)).toBeNull();
  });

  it("jumps to the ends and ignores invalid positions", () => {
    expect(resolveMarksGridTarget(1, "Home", false, 3)).toBe(0);
    expect(resolveMarksGridTarget(1, "End", false, 3)).toBe(2);
    expect(resolveMarksGridTarget(-1, "Enter", false, 3)).toBeNull();
    expect(resolveMarksGridTarget(0, "Enter", false, 0)).toBeNull();
  });
});
