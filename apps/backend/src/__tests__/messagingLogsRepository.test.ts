import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@mms/shared";

const { state } = vi.hoisted(() => ({
  state: {
    inserted: [] as Array<{ id: string }>,
    values: null as unknown[] | null,
    selectCalls: [] as unknown[][],
    mockRows: [] as unknown[],
  },
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      insert: () => ({
        values: (rows: unknown[]) => {
          state.values = rows;
          return {
            onConflictDoNothing: () => ({
              returning: async () => state.inserted,
            }),
          };
        },
      }),
      select: () => ({
        from: () => ({
          where: async (_cond: unknown) => {
            state.selectCalls.push(state.mockRows);
            return state.mockRows;
          },
        }),
      }),
    }),
}));

import {
  findMessageLogsByIds,
  insertMessageLogs,
} from "../db/repositories/messagingLogsRepository.js";

function log(id: string): Message {
  return {
    id,
    userId: "u-1",
    contactId: `c-${id}`,
    channel: "sms",
    body: "Hello",
    sentAt: "2026-11-04T00:00:00.000Z",
    status: "sent",
    category: "general",
  };
}

describe("insertMessageLogs", () => {
  beforeEach(() => {
    state.inserted = [];
    state.values = null;
    state.selectCalls = [];
    state.mockRows = [];
  });

  it("reports the number of rows actually persisted, not the submitted length", async () => {
    state.inserted = [{ id: "m-1" }];

    await expect(insertMessageLogs("demo", [log("m-1"), log("m-2")])).resolves.toBe(1);
    expect(state.values).toHaveLength(2);

    // ON CONFLICT DO NOTHING persisted nothing (id already recorded).
    state.inserted = [];
    await expect(insertMessageLogs("demo", [log("m-1")])).resolves.toBe(0);
  });

  it("dedupes repeated ids inside one batch and skips empty input", async () => {
    state.inserted = [{ id: "m-1" }];

    await insertMessageLogs("demo", [log("m-1"), log("m-1")]);
    expect(state.values).toHaveLength(1);

    await expect(insertMessageLogs("demo", [])).resolves.toBe(0);
  });
});

describe("findMessageLogsByIds", () => {
  beforeEach(() => {
    state.inserted = [];
    state.values = null;
    state.selectCalls = [];
    state.mockRows = [];
  });

  it("returns empty array when given empty or whitespace-only ids", async () => {
    await expect(findMessageLogsByIds("demo", [])).resolves.toEqual([]);
    await expect(findMessageLogsByIds("demo", ["", "   "])).resolves.toEqual([]);
    expect(state.selectCalls).toHaveLength(0);
  });

  it("chunks queries into batches of 250 when querying many ids", async () => {
    const ids = Array.from({ length: 520 }, (_, i) => `msg_${i}`);
    await findMessageLogsByIds("demo", ids);
    // 520 items with 250 batch size should produce ceil(520/250) = 3 select queries
    expect(state.selectCalls).toHaveLength(3);
  });
});
