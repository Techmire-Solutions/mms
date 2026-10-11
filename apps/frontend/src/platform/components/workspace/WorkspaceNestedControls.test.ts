import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const switchCellsPath = join(
  process.cwd(),
  "src/platform/components/workspace/WorkspaceTableSwitchCells.tsx",
);
const listCardsPath = join(
  process.cwd(),
  "src/platform/components/workspace/WorkspaceListCards.tsx",
);

describe("platform workspace nested interactive controls", () => {
  it("given row/card inspect handlers, should stopPropagation on nested switches and selection", () => {
    // Arrange
    const switchCells = readFileSync(switchCellsPath, "utf8");
    const listCards = readFileSync(listCardsPath, "utf8");

    // Assert — table switch cells isolate nested clicks from row inspect
    expect(switchCells).toContain("e.stopPropagation()");
    expect(switchCells).toContain("WorkspaceEnabledCell");
    expect(switchCells).toContain("WorkspaceEmailVerificationCell");

    // Assert — card selection + footer actions isolate nested clicks from card inspect
    expect(listCards).toContain("onCardClick={onInspect");
    expect(listCards).toContain("e.stopPropagation()");
  });
});
