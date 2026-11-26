import { describe, expect, it } from "vitest";
import { mapTaskRow } from "../repository/db/tasksRowMapping.js";
import type { SELECT_COLS } from "../repository/db/tasksRowMapping.js";
import type { tasks } from "@mms/db/schema";

type Row = { [K in keyof typeof SELECT_COLS]: (typeof tasks.$inferSelect)[K] };

describe("mapTaskRow", () => {
  it("populates creatorName from the creator-names map (m15)", () => {
    const row: Row = {
      id: "t1",
      workspaceSubdomain: "demo",
      title: "Task",
      description: null,
      status: "todo",
      priority: "medium",
      startDate: null,
      dueAt: new Date("2026-10-01T00:00:00.000Z"),
      parentTaskId: null,
      createdByUserId: "u-1",
      deletedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const result = mapTaskRow(row, new Map(), new Map([["u-1", "Principal"]]));

    expect(result.creatorName).toBe("Principal");
    expect(result.createdById).toBe("u-1");
  });
});
