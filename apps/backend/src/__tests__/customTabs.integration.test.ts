import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";
import { getObject, saveObject, getAllData } from "../db/database.js";

const inMemoryStore = new Map<string, unknown>();

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  getObject: vi.fn().mockImplementation(async (key: string) => inMemoryStore.get(key) ?? null),
  saveObject: vi.fn().mockImplementation(async (key: string, data: unknown) => {
    inMemoryStore.set(key, data);
    return data;
  }),
  getAllData: vi.fn().mockImplementation(async () => ({
    objects: Object.fromEntries(inMemoryStore.entries()),
    collections: {},
  })),
}));

describe("custom tabs relational migration and operations", () => {
  beforeEach(() => {
    inMemoryStore.clear();
  });

  it("saves, hydrates, and gets custom tabs dynamically", async () => {
    await runWithTenant("demo", async () => {
      const configKey = "contact_field_config";
      const mockConfigPayload = {
        version: 42,
        fields: {
          firstName: { key: "firstName", type: "text", required: true },
        },
        formTabs: [
          { key: "basic", label: "Basic Info", enabled: true, order: 0 },
          {
            key: "custom_sub_tab",
            label: "Additional Data",
            enabled: true,
            order: 1,
            color: "blue",
          },
        ],
      };

      // 1. Save object with custom formTabs
      await saveObject(configKey, mockConfigPayload);

      // 2. Fetch the object and verify hydration
      const fetched = (await getObject(configKey)) as Record<string, unknown> & {
        version: number;
        fields: Record<string, { key: string }>;
        formTabs: { key: string; color?: string }[];
      };
      expect(fetched).not.toBeNull();
      expect(fetched.version).toBe(42);
      expect(fetched.fields.firstName.key).toBe("firstName");
      expect(Array.isArray(fetched.formTabs)).toBe(true);
      expect(fetched.formTabs.length).toBe(2);
      expect(fetched.formTabs[0]?.key).toBe("basic");
      expect(fetched.formTabs[1]?.key).toBe("custom_sub_tab");
      expect(fetched.formTabs[1]?.color).toBe("blue");

      // 3. Verify in getAllData
      const snapshot = await getAllData();
      const snapshotConfig = snapshot.objects[configKey] as Record<string, unknown> & {
        formTabs: { key: string }[];
      };
      expect(typeof snapshotConfig).toBe("object");
      expect(Array.isArray(snapshotConfig.formTabs)).toBe(true);
      expect(snapshotConfig.formTabs.length).toBe(2);
      expect(snapshotConfig.formTabs[1]?.key).toBe("custom_sub_tab");
    });
  });
});
