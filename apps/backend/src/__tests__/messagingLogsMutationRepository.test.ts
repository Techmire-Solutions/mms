import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    updateSet: null as Record<string, unknown> | null,
    updateWhere: null as unknown,
    deleteReturning: [] as Array<{ id: string }>,
    insertValues: null as Array<Record<string, unknown>> | null,
    conflictConfig: null as Record<string, unknown> | null,
  },
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      update: () => ({
        set: (values: Record<string, unknown>) => {
          state.updateSet = values;
          return {
            where: (clause: unknown) => {
              state.updateWhere = clause;
              return { returning: async () => state.deleteReturning };
            },
          };
        },
      }),
      delete: () => ({
        where: () => ({ returning: async () => state.deleteReturning }),
      }),
      insert: () => ({
        values: (values: Array<Record<string, unknown>>) => {
          state.insertValues = values;
          return {
            onConflictDoUpdate: async (config: Record<string, unknown>) => {
              state.conflictConfig = config;
            },
          };
        },
      }),
    }),
}));

import {
  saveMessageLogDeliveryOutcomes,
  softDeleteActiveMessageLogs,
} from "../db/repositories/messagingLogsMutationRepository.js";

function outcome(id: string, status: "sent" | "failed", errorMessage?: string) {
  return {
    id,
    userId: "u-1",
    contactId: `c-${id}`,
    channel: "sms",
    body: `Body ${id}`,
    sentAt: "2026-11-04T00:00:00.000Z",
    category: "general",
    status,
    errorMessage,
  };
}

describe("softDeleteActiveMessageLogs", () => {
  beforeEach(() => {
    state.updateSet = null;
    state.updateWhere = null;
    state.deleteReturning = [];
  });

  it("stamps the archiving actor and reason on every cleared log", async () => {
    await softDeleteActiveMessageLogs("demo", "u-admin");

    expect(state.updateSet).toEqual(
      expect.objectContaining({
        deletedBy: "u-admin",
        deletionReason: "messaging.logs.clear",
      }),
    );
    expect(state.updateSet?.deletedAt).toBeInstanceOf(Date);
    expect(state.updateWhere).toBeDefined();
  });

  it("normalizes the tenant subdomain before writing", async () => {
    await softDeleteActiveMessageLogs("  DEMO  ", "u-admin");
    expect(state.updateSet).toEqual(
      expect.objectContaining({ deletedBy: "u-admin", deletionReason: "messaging.logs.clear" }),
    );
  });
});

describe("saveMessageLogDeliveryOutcomes", () => {
  beforeEach(() => {
    state.insertValues = null;
    state.conflictConfig = null;
  });

  it("writes one insert for the whole batch and only updates outcome columns", async () => {
    await saveMessageLogDeliveryOutcomes("  DEMO ", [
      outcome("a", "sent"),
      outcome("b", "failed", "Gateway rejected dispatch"),
    ]);

    expect(state.insertValues).toHaveLength(2);
    expect(state.insertValues?.[0]).toEqual(
      expect.objectContaining({
        id: "a",
        workspaceSubdomain: "demo",
        status: "sent",
        errorMessage: null,
        category: "general",
      }),
    );
    expect(state.insertValues?.[1]).toEqual(
      expect.objectContaining({
        id: "b",
        status: "failed",
        errorMessage: "Gateway rejected dispatch",
      }),
    );
    // `set` must not touch body/channel/soft-delete columns of an existing row.
    const set = state.conflictConfig?.set as Record<string, unknown>;
    expect(Object.keys(set).sort()).toEqual(["errorMessage", "status", "updatedAt"]);
    expect(set.updatedAt).toBeInstanceOf(Date);
  });

  it("dedupes ids and skips blank ones", async () => {
    await saveMessageLogDeliveryOutcomes("demo", [
      outcome("a", "failed", "first"),
      outcome("a", "sent"),
      outcome("  ", "sent"),
    ]);

    expect(state.insertValues).toHaveLength(1);
    expect(state.insertValues?.[0]).toEqual(expect.objectContaining({ id: "a", status: "sent" }));
  });

  it("no-ops for an empty batch or a missing tenant", async () => {
    await saveMessageLogDeliveryOutcomes("demo", []);
    await saveMessageLogDeliveryOutcomes("   ", [outcome("a", "sent")]);
    expect(state.insertValues).toBeNull();
  });
});
