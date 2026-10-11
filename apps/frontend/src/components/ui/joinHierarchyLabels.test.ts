import { describe, expect, it } from "vitest";
import { HIERARCHY_LABEL_SEPARATOR, joinHierarchyLabels } from "./joinHierarchyLabels";

describe("joinHierarchyLabels", () => {
  it("joins non-empty labels with a BiDi-safe separator", () => {
    expect(joinHierarchyLabels(["Dean", "Chair", "Lecturer"])).toBe(
      `Dean${HIERARCHY_LABEL_SEPARATOR}Chair${HIERARCHY_LABEL_SEPARATOR}Lecturer`,
    );
  });

  it("drops blank labels", () => {
    expect(joinHierarchyLabels(["A", "  ", "", "B"])).toBe(`A${HIERARCHY_LABEL_SEPARATOR}B`);
  });

  it("returns empty string for no labels", () => {
    expect(joinHierarchyLabels([])).toBe("");
  });
});
