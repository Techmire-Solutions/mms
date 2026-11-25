import { describe, expect, it, beforeEach } from "vitest";
import { loadPreferences, setPreferencesMemory, savePreferences } from "./preferencesStorage.js";
import { normalizeContactPreferences } from "@mms/contracts";

describe("preferencesStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    setPreferencesMemory(normalizeContactPreferences({}));
  });

  it("loads normalized contact preferences", () => {
    const prefs = loadPreferences();
    expect(typeof prefs).toBe("object");
    expect(typeof prefs.defaultCountry).toBe("string");
  });

  it("updates preferences in memory and clears legacy localStorage key", () => {
    localStorage.setItem("mms_contact_preferences", JSON.stringify({ defaultCountry: "PK" }));
    const custom = normalizeContactPreferences({ defaultCountry: "PK" });
    setPreferencesMemory(custom);

    expect(loadPreferences().defaultCountry).toBe("PK");
    expect(localStorage.getItem("mms_contact_preferences")).toBeNull();
  });

  it("savePreferences sets memory state optimistically", () => {
    const updated = normalizeContactPreferences({ defaultCountry: "US" });
    savePreferences(updated);
    expect(loadPreferences().defaultCountry).toBe("US");
  });
});
