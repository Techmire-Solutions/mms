import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPlatformSettings,
  maskPlatformSettingsForClient,
  mergePlatformSettingsInput,
  updatePlatformSettings,
} from "../platform/services/platformSettingsService.js";

vi.mock("@mms/db/client", () => {
  const mockRows: Record<string, unknown>[] = [];
  const mockDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mockRows,
        }),
      }),
    }),
    insert: () => ({
      values: (val: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: async () => [val],
        }),
        onConflictDoUpdate: async () => [val],
      }),
    }),
  };
  return {
    getDb: () => mockDb,
    getRootDb: () => mockDb,
    activeDb: () => mockDb,
    hasActiveTransaction: () => false,
    withActiveTransaction: (_tx: unknown, cb: <T>() => T) => cb(),
  };
});

describe("platformSettingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns platform settings and updates cache on update", async () => {
    const initial = getPlatformSettings();
    expect(initial.id).toBe("global");

    const updated = await updatePlatformSettings({
      certbotEmail: "admin@example.com",
      syncTlsOnCreate: true,
      tlsExtraSans: "*.example.com",
    });

    expect(updated.certbotEmail).toBe("admin@example.com");
    expect(updated.syncTlsOnCreate).toBe(true);
    expect(updated.tlsExtraSans).toBe("*.example.com");

    const cached = getPlatformSettings();
    expect(cached.certbotEmail).toBe("admin@example.com");
  });

  it("masks LLM secrets for client responses", () => {
    const masked = maskPlatformSettingsForClient({
      ...getPlatformSettings(),
      llmApiKey: "super-secret-key",
      llmConfigs: [
        {
          id: "c1",
          name: "Primary",
          provider: "openai",
          apiKey: "another-secret",
          model: "gpt-4o-mini",
          isDefaultText: true,
        },
      ],
    });
    expect(masked.llmApiKey).toBe("****-key");
    expect(masked.llmConfigs[0]?.apiKey).toBe("****cret");
  });

  it("retains stored LLM secrets when the client sends masked/omitted values", () => {
    const current = {
      ...getPlatformSettings(),
      llmApiKey: "stored-key",
      llmConfigs: [
        {
          id: "c1",
          name: "Primary",
          provider: "openai" as const,
          apiKey: "stored-config-key",
          model: "gpt-4o-mini",
          isDefaultText: true,
        },
      ],
    };
    const merged = mergePlatformSettingsInput(current, {
      llmApiKey: "****-key",
      llmConfigs: [
        {
          id: "c1",
          name: "Primary",
          provider: "openai",
          apiKey: "****-key",
          model: "gpt-4o-mini",
          isDefaultText: true,
        },
        {
          id: "c2",
          name: "Secondary",
          provider: "gemini",
          apiKey: "brand-new-key",
          model: "gemini-2.5-flash",
          isDefaultText: false,
        },
      ],
    });
    expect(merged.llmApiKey).toBe("stored-key");
    expect(merged.llmConfigs[0]?.apiKey).toBe("stored-config-key");
    expect(merged.llmConfigs[1]?.apiKey).toBe("brand-new-key");
  });

  it("does not cache a masked key over the stored value on update", async () => {
    await updatePlatformSettings({ llmApiKey: "real-secret-key" });
    const updated = await updatePlatformSettings({ llmApiKey: "****-key" });
    expect(updated.llmApiKey).toBe("real-secret-key");
  });
});
