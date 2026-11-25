import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessagingPreferences } from "@mms/contracts";

const { state } = vi.hoisted(() => ({
  state: {
    selectRows: [] as unknown[],
    upsertValues: null as unknown,
    upsertConflictSet: null as unknown,
  },
}));

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenant: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => state.selectRows,
          }),
        }),
      }),
      insert: () => ({
        values: (vals: unknown) => {
          state.upsertValues = vals;
          return {
            onConflictDoUpdate: async (config: { set: unknown }) => {
              state.upsertConflictSet = config.set;
            },
          };
        },
      }),
    }),
}));

import {
  loadMessagingPreferences,
  saveMessagingPreferences,
} from "../db/repositories/messagingPreferencesRepository.js";

describe("messagingPreferencesRepository", () => {
  beforeEach(() => {
    state.selectRows = [];
    state.upsertValues = null;
    state.upsertConflictSet = null;
  });

  describe("loadMessagingPreferences", () => {
    it("returns null when workspaceSubdomain is empty or blank", async () => {
      await expect(loadMessagingPreferences("")).resolves.toBeNull();
      await expect(loadMessagingPreferences("   ")).resolves.toBeNull();
    });

    it("returns mapped preferences when record exists", async () => {
      state.selectRows = [
        {
          workspaceSubdomain: "demo",
          defaultChannel: "whatsapp",
          defaultSmsMode: "gateway",
          defaultDispatchSpeed: "express",
          defaultCountryCode: "+92",
          updatedAt: new Date("2026-11-18T10:00:00.000Z"),
        },
      ];

      const prefs = await loadMessagingPreferences("demo");
      expect(prefs).toEqual({
        defaultChannel: "whatsapp",
        defaultSmsMode: "gateway",
        defaultDispatchSpeed: "express",
        defaultCountryCode: "+92",
      });
    });

    it("defaults defaultCountryCode to empty string when column is null", async () => {
      state.selectRows = [
        {
          workspaceSubdomain: "demo",
          defaultChannel: "sms",
          defaultSmsMode: "device",
          defaultDispatchSpeed: "normal",
          defaultCountryCode: null,
          updatedAt: new Date(),
        },
      ];

      const prefs = await loadMessagingPreferences("demo");
      expect(prefs?.defaultCountryCode).toBe("");
    });

    it("returns null when no row is found", async () => {
      state.selectRows = [];
      await expect(loadMessagingPreferences("demo")).resolves.toBeNull();
    });
  });

  describe("saveMessagingPreferences", () => {
    it("no-ops when workspaceSubdomain is empty or blank", async () => {
      const dummyPrefs: MessagingPreferences = {
        defaultChannel: "sms",
        defaultSmsMode: "device",
        defaultDispatchSpeed: "normal",
        defaultCountryCode: "+1",
      };
      await saveMessagingPreferences("", dummyPrefs);
      expect(state.upsertValues).toBeNull();
    });

    it("upserts preferences with normalized lowercase subdomain", async () => {
      const prefs: MessagingPreferences = {
        defaultChannel: "whatsapp",
        defaultSmsMode: "gateway",
        defaultDispatchSpeed: "safe",
        defaultCountryCode: "+44",
      };
      await saveMessagingPreferences(" DEMO ", prefs);
      expect(state.upsertValues).toMatchObject({
        workspaceSubdomain: "demo",
        defaultChannel: "whatsapp",
        defaultSmsMode: "gateway",
        defaultDispatchSpeed: "safe",
        defaultCountryCode: "+44",
      });
      expect(state.upsertConflictSet).toBeDefined();
    });
  });
});
