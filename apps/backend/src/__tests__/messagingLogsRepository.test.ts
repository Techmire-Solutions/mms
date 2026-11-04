import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@mms/shared";

const { state } = vi.hoisted(() => ({
  state: {
    inserted: [] as Array<{ id: string }>,
    values: null as unknown[] | null,
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
    }),
}));

import { insertMessageLogs } from "../db/repositories/messagingLogsRepository.js";

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
