import { describe, expect, it, vi } from "vitest";
import {
  fetchExaminationPreferences,
  saveExaminationPreferencesAsync,
  setExaminationPreferencesMemory,
  getExaminationSettingsMemoryFallback,
} from "./examinationSetupConfigApi";

vi.mock("@/lib/api", () => ({
  apiContract: {
    examinations: {
      getPreferences: vi.fn().mockResolvedValue({
        body: {
          preferences: {
            gradingSystem: "percentage",
            certificateTemplate: "default",
          },
        },
      }),
      updatePreferences: vi.fn().mockResolvedValue({
        body: {
          preferences: {
            gradingSystem: "letter",
            certificateTemplate: "modern",
          },
        },
      }),
    },
  },
}));

describe("examinationSetupConfigApi", () => {
  it("fetches and saves examination preferences via contract API", async () => {
    const prefs = await fetchExaminationPreferences();
    expect(prefs).toBeDefined();

    const updated = await saveExaminationPreferencesAsync({
      gradingSystem: "letter",
      certificateTemplate: "modern",
    } as unknown as never);
    expect(updated).toBeDefined();

    setExaminationPreferencesMemory({ gradingSystem: "gpa" } as unknown as never);
    const fallback = getExaminationSettingsMemoryFallback();
    expect(fallback).toBeDefined();
  });
});
