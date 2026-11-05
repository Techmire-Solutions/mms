import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiError";

const h = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  getLookups: vi.fn(),
  updateLookupKind: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiContract: {
    sessions: {
      getPreferences: h.getPreferences,
      updatePreferences: h.updatePreferences,
      getLookups: h.getLookups,
      updateLookupKind: h.updateLookupKind,
    },
  },
}));

import { fetchSessionPreferences, saveSessionPreferencesAsync } from "./sessionSetupConfigApi";
import { fetchSessionLookups, putSessionLookupKind } from "./useSessionLookups";

const forbidden = { status: 403, body: { type: "forbidden", message: "Insufficient permissions" } };

describe("sessions setup API status handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a 403 when loading preferences", async () => {
    h.getPreferences.mockResolvedValueOnce(forbidden);
    await expect(fetchSessionPreferences()).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects a 403 when saving preferences (no silent default success)", async () => {
    h.updatePreferences.mockResolvedValueOnce(forbidden);
    await expect(saveSessionPreferencesAsync({} as never)).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects a 403 when loading lookups", async () => {
    h.getLookups.mockResolvedValueOnce(forbidden);
    await expect(fetchSessionLookups()).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects a 403 when saving a lookup kind (does not return [])", async () => {
    h.updateLookupKind.mockResolvedValueOnce(forbidden);
    await expect(putSessionLookupKind("statuses", ["open"])).rejects.toBeInstanceOf(ApiError);
  });
});
