import { describe, expect, it } from "vitest";
import { clampElementBox } from "./templateEditorBounds";

const page = { width: 400, height: 500, label: "A6" };

describe("clampElementBox", () => {
  it("keeps a valid box untouched", () => {
    const box = { x: 10, y: 20, w: 100, h: 50 };
    expect(clampElementBox(box, page)).toEqual(box);
  });

  it("pushes an off-page element back onto the page", () => {
    expect(clampElementBox({ x: 500, y: 700, w: 100, h: 50 }, page)).toMatchObject({
      x: 300,
      y: 450,
    });
  });

  it("clamps a box larger than the page to the page size", () => {
    expect(clampElementBox({ x: 10, y: 10, w: 900, h: 900 }, page)).toMatchObject({
      w: 400,
      h: 500,
      x: 0,
      y: 0,
    });
  });

  it("enforces the minimum element size", () => {
    expect(clampElementBox({ x: 0, y: 0, w: 1, h: 1 }, page)).toMatchObject({ w: 20, h: 4 });
  });
});
