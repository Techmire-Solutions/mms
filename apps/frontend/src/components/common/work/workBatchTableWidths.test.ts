import { describe, expect, it } from "vitest";
import { MODULE_COLUMN_KIND_WIDTHS } from "@mms/shared";
import {
  computeWorkTableMinWidth,
  resolveWorkColumnMinWidth,
  resolveWorkColumnWidth,
  WORK_TABLE_ACTIONS_WIDTH,
  WORK_TABLE_SELECTION_WIDTH,
  WORK_TABLE_UNSIZED_COLUMN_FLOOR,
} from "./workBatchTableWidths";

describe("workBatchTableWidths", () => {
  it("given a stored width, should prefer it over the column default", () => {
    // Arrange
    const column = { width: 140 };

    // Act
    const width = resolveWorkColumnWidth(column, 260);

    // Assert
    expect(width).toBe(260);
  });

  it("given a stale stored width below the kind floor, should raise it to the floor", () => {
    // Arrange
    const column = { kind: "phone" as const };

    // Act
    const width = resolveWorkColumnWidth(column, 80);

    // Assert
    expect(width).toBe(MODULE_COLUMN_KIND_WIDTHS.phone.minWidth);
  });

  it("given no width and no kind, should leave the column unsized", () => {
    // Arrange
    const column = {};

    // Act
    const width = resolveWorkColumnWidth(column, undefined);

    // Assert
    expect(width).toBeUndefined();
  });

  it("given a kind, should expose the kind floor as the resize minimum", () => {
    // Arrange
    const kinded = { kind: "chips" as const };
    const plain = {};

    // Act
    const kindedMin = resolveWorkColumnMinWidth(kinded);
    const plainMin = resolveWorkColumnMinWidth(plain);

    // Assert
    expect(kindedMin).toBe(MODULE_COLUMN_KIND_WIDTHS.chips.minWidth);
    expect(plainMin).toBeUndefined();
  });

  it("given sized and unsized columns, should sum widths plus chrome into the table minimum", () => {
    // Arrange
    const widths = [200, undefined, 150];

    // Act
    const minWidth = computeWorkTableMinWidth(widths, { selection: true, actions: true });

    // Assert
    expect(minWidth).toBe(
      200 +
        WORK_TABLE_UNSIZED_COLUMN_FLOOR +
        150 +
        WORK_TABLE_SELECTION_WIDTH +
        WORK_TABLE_ACTIONS_WIDTH,
    );
  });

  it("given no selection or actions, should sum only the column widths", () => {
    // Arrange
    const widths = [100, 120];

    // Act
    const minWidth = computeWorkTableMinWidth(widths, { selection: false, actions: false });

    // Assert
    expect(minWidth).toBe(220);
  });
});
