import { describe, expect, it } from "vitest";
import { uniqueIds } from "../repository/db/tasksBulkSkips.js";

describe("tasksBulkSkips", () => {
  describe("uniqueIds", () => {
    it("deduplicates, trims and filters empty IDs in original order", () => {
      const input = [" task-1 ", "task-2", "task-1", "", "   ", "task-3"];
      const result = uniqueIds(input);
      expect(result).toEqual(["task-1", "task-2", "task-3"]);
    });

    it("returns empty array for empty input", () => {
      expect(uniqueIds([])).toEqual([]);
      expect(uniqueIds(["", "   "])).toEqual([]);
    });
  });
});
