import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the repository + db modules so saveGlobalSettings can be tested in isolation.
vi.mock("../db/repositories/workspaceRepository.js", () => ({
  getWorkspaceGlobalSettings: vi.fn(),
  upsertWorkspaceGlobalSettings: vi.fn(),
}));
vi.mock("../db/database.js", () => ({
  saveObject: vi.fn(),
}));
vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: vi.fn(() => "alpha"),
}));

import {
  maskSecret,
  isMaskedSecret,
  maskGlobalSettingsForClient,
  saveGlobalSettings,
} from "../services/globalSettingsService.js";
import {
  getWorkspaceGlobalSettings,
  upsertWorkspaceGlobalSettings,
} from "../db/repositories/workspaceRepository.js";
import { saveObject } from "../db/database.js";

const mockedGet = vi.mocked(getWorkspaceGlobalSettings);
const mockedUpsert = vi.mocked(upsertWorkspaceGlobalSettings);
const mockedSaveObject = vi.mocked(saveObject);

describe("LLM secret masking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("masks a secret to its last 4 characters", () => {
    expect(maskSecret("sk-abcdefgh1234")).toBe("****1234");
    expect(maskSecret("")).toBe("");
    expect(maskSecret(undefined)).toBe("");
    expect(maskSecret("abcd")).toBe("****");
  });

  it("detects masked secrets", () => {
    expect(isMaskedSecret("****1234")).toBe(true);
    expect(isMaskedSecret("sk-abcdefgh1234")).toBe(false);
    expect(isMaskedSecret("")).toBe(false);
    expect(isMaskedSecret(undefined)).toBe(false);
  });

  it("masks the legacy llmApiKey and every llmConfigs[].apiKey for the client", () => {
    const masked = maskGlobalSettingsForClient({
      llmApiKey: "legacy-secret-9999",
      llmConfigs: [
        {
          id: "c1",
          name: "Gemini",
          provider: "gemini",
          apiKey: "gem-key-1111",
          model: "gemini-pro",
          isDefaultText: true,
        },
        {
          id: "c2",
          name: "OpenAI",
          provider: "openai",
          apiKey: "oa-key-2222",
          model: "gpt-4o",
          isDefaultText: false,
        },
      ],
    } as never);

    expect(masked.llmApiKey).toBe("****9999");
    expect(masked.llmConfigs[0].apiKey).toBe("****1111");
    expect(masked.llmConfigs[1].apiKey).toBe("****2222");
    // Non-secret fields are preserved.
    expect(masked.llmConfigs[0].name).toBe("Gemini");
    expect(masked.llmConfigs[0].provider).toBe("gemini");
  });

  it("preserves the stored full keys when the client saves masked values back", async () => {
    mockedGet.mockResolvedValue({
      llmApiKey: "real-legacy-key",
      llmConfigs: [
        {
          id: "c1",
          name: "Gemini",
          provider: "gemini",
          apiKey: "real-gem-key",
          model: "gemini-pro",
          isDefaultText: true,
        },
      ],
    } as never);

    await saveGlobalSettings({
      llmApiKey: "****-key",
      llmConfigs: [
        {
          id: "c1",
          name: "Gemini",
          provider: "gemini",
          apiKey: "****-key",
          model: "gemini-pro",
          isDefaultText: true,
        },
      ],
    } as never);

    const saved = mockedUpsert.mock.calls[0][1] as {
      llmApiKey: string;
      llmConfigs: Array<{ id: string; apiKey: string }>;
    };
    expect(saved.llmApiKey).toBe("real-legacy-key");
    expect(saved.llmConfigs[0].apiKey).toBe("real-gem-key");
    expect(mockedSaveObject).toHaveBeenCalledWith("global_settings", expect.anything());
  });

  it("stores a genuinely new (non-masked) key as-is", async () => {
    mockedGet.mockResolvedValue({ llmApiKey: "old-key", llmConfigs: [] } as never);

    await saveGlobalSettings({
      llmApiKey: "brand-new-key",
      llmConfigs: [
        {
          id: "c1",
          name: "OpenAI",
          provider: "openai",
          apiKey: "brand-new-config-key",
          model: "gpt-4o",
          isDefaultText: true,
        },
      ],
    } as never);

    const saved = mockedUpsert.mock.calls[0][1] as {
      llmApiKey: string;
      llmConfigs: Array<{ id: string; apiKey: string }>;
    };
    expect(saved.llmApiKey).toBe("brand-new-key");
    expect(saved.llmConfigs[0].apiKey).toBe("brand-new-config-key");
  });
});
