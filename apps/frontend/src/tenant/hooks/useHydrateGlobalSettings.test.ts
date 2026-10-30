import { describe, expect, it } from "vitest";
import { DEFAULT_GLOBAL_SETTINGS } from "@mms/shared";
import { mergeServerLocalization } from "@/lib/globalSettingsHydration";

describe("mergeServerLocalization", () => {
  it("adopts server localization fields without dropping local preferences", () => {
    const merged = mergeServerLocalization(
      { ...DEFAULT_GLOBAL_SETTINGS, language: "en", llmApiKey: "local-secret" },
      { language: "ar", timezone: "Asia/Riyadh", dateFormat: "YYYY-MM-DD" },
    );

    expect(merged.language).toBe("ar");
    expect(merged.timezone).toBe("Asia/Riyadh");
    expect(merged.dateFormat).toBe("YYYY-MM-DD");
    expect(merged.llmApiKey).toBe("local-secret");
  });

  it("keeps local settings when the server payload is unavailable", () => {
    const current = { ...DEFAULT_GLOBAL_SETTINGS, language: "ur" as const };
    expect(mergeServerLocalization(current, null)).toEqual(current);
  });
});
