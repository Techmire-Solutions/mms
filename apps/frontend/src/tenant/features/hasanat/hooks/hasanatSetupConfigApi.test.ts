import { describe, expect, it, vi } from "vitest";
import {
  setHasanatPreferencesMemory,
  fetchHasanatPreferences,
  saveHasanatPreferencesAsync,
  getHasanatSettingsMemoryFallback,
} from "./hasanatSetupConfigApi";

vi.mock("@/lib/api", () => ({
  apiContract: {
    hasanat: {
      getPreferences: vi.fn().mockResolvedValue({
        body: {
          preferences: {
            pointsPerUnit: 10,
          },
        },
      }),
      updatePreferences: vi.fn().mockResolvedValue({
        body: {
          preferences: {
            pointsPerUnit: 20,
          },
        },
      }),
    },
  },
}));

import { apiContract } from "@/lib/api";

describe("hasanatSetupConfigApi utilities", () => {
  it("fetches and saves hasanat preferences", async () => {
    const fetched = await fetchHasanatPreferences();
    expect(fetched?.pointsPerUnit).toBe(10);

    const saved = await saveHasanatPreferencesAsync({
      pointsPerUnit: 20,
    } as unknown as never);
    expect(saved?.pointsPerUnit).toBe(20);
  });

  it("manages in-memory fallback", () => {
    setHasanatPreferencesMemory({ pointsPerUnit: 25 } as unknown as never);
    const memory = getHasanatSettingsMemoryFallback();
    expect(memory?.pointsPerUnit).toBe(25);
  });

  it("forwards the caller's AbortSignal so query cancellation reaches the transport", async () => {
    const signal = new AbortController().signal;
    await fetchHasanatPreferences(signal);

    const getPreferences = vi.mocked(apiContract.hasanat.getPreferences);
    const callArgs = getPreferences.mock.calls.at(-1)?.[0];
    expect(callArgs?.signal).toBe(signal);
    expect(callArgs?.fetchOptions?.signal).toBe(signal);
  });
});
