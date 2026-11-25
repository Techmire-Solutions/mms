import { describe, expect, it } from "vitest";
import type { FieldDefinition, TabDefinition } from "./contactFieldSchemaTypes.js";
import {
  CONTACT_LEGACY_CUSTOM_FORM_TAB,
  DEFAULT_FORM_TABS,
  getContactSeedFormTab,
} from "./contactTabRegistry.js";
import { mergeContactsFormTabsFromApi } from "./contactFormTabsMerge.js";

function makeTab(key: string, overrides: Partial<TabDefinition> = {}): TabDefinition {
  return { key, label: key, enabled: true, order: 0, ...overrides };
}

function makeField(tabId: string): { tabId: string; field: FieldDefinition } {
  const field: FieldDefinition = {
    key: "nickname",
    label: "Nickname",
    type: "text",
    enabled: true,
    order: 0,
  };
  return { tabId, field };
}

describe("mergeContactsFormTabsFromApi", () => {
  it("returns DEFAULT_FORM_TABS when API and document tabs are empty", () => {
    const merged = mergeContactsFormTabsFromApi(undefined, []);
    expect(merged).toEqual(DEFAULT_FORM_TABS);
  });

  it("returns the document tabs when API is empty and document tabs exist", () => {
    const documentTabs = [makeTab("basic"), makeTab("phones")];
    const merged = mergeContactsFormTabsFromApi(documentTabs, []);
    expect(merged).toEqual(documentTabs);
  });

  it("merges API tabs plus missing seed tabs when API is non-empty", () => {
    const apiTabs = [makeTab("phones", { label: "Contact Numbers" })];
    const merged = mergeContactsFormTabsFromApi(undefined, apiTabs);

    expect(merged.map((tab) => tab.key)).toContain("phones");
    expect(merged.map((tab) => tab.key)).toContain("basic");
    expect(merged.map((tab) => tab.key)).toContain("emails");
    expect(merged.map((tab) => tab.key)).toContain("addresses");
    expect(merged.map((tab) => tab.key)).toContain("socials");
    expect(merged.map((tab) => tab.key)).toContain("education");
    expect(merged.map((tab) => tab.key)).toContain("experience");
    expect(merged.map((tab) => tab.key)).toContain("skills");
    expect(merged.map((tab) => tab.key)).toContain("relationship");
    expect(merged.map((tab) => tab.key)).toHaveLength(DEFAULT_FORM_TABS.length);
    // API tab preserves its custom label; seed tab falls back to default seed label.
    expect(merged.find((tab) => tab.key === "phones")?.label).toBe("Contact Numbers");
    expect(merged.find((tab) => tab.key === "basic")?.label).toBe(
      DEFAULT_FORM_TABS.find((tab) => tab.key === "basic")?.label,
    );
  });

  it("does not duplicate a seed tab already present in the API", () => {
    const apiTabs = [makeTab("basic")];
    const merged = mergeContactsFormTabsFromApi(undefined, apiTabs);

    const basicCount = merged.filter((tab) => tab.key === "basic").length;
    expect(basicCount).toBe(1);
    expect(merged).toHaveLength(DEFAULT_FORM_TABS.length);
  });

  it("normalizes a legacy emergency tab to relationship (key and label)", () => {
    const apiTabs = [makeTab("emergency", { label: "Emergency" })];
    const merged = mergeContactsFormTabsFromApi(undefined, apiTabs);

    const relationshipTab = merged.find((tab) => tab.key === "relationship");
    expect(relationshipTab?.key).toBe("relationship");
    expect(relationshipTab?.label).toBe("Relationship");
    // Relationship seed only appears once after normalization/dedup.
    expect(merged.filter((tab) => tab.key === "relationship")).toHaveLength(1);
  });

  it("drops the retired seed custom tab when no fields live under it", () => {
    const apiTabs = [CONTACT_LEGACY_CUSTOM_FORM_TAB];
    const merged = mergeContactsFormTabsFromApi(undefined, apiTabs, {});

    expect(merged.find((tab) => tab.key === "custom")).toBeUndefined();
  });

  it("keeps the retired seed custom tab when fields still reference it", () => {
    const apiTabs = [CONTACT_LEGACY_CUSTOM_FORM_TAB];
    const { tabId, field } = makeField("custom");
    const merged = mergeContactsFormTabsFromApi(undefined, apiTabs, { [tabId]: [field] });

    const customTab = merged.find((tab) => tab.key === "custom");
    expect(customTab?.key).toBe("custom");
    expect(customTab?.label).toBe(CONTACT_LEGACY_CUSTOM_FORM_TAB.label);
    expect(customTab?.isSystem).toBe(true);
  });

  it("keeps the seed basic tab when a system seed tab is present", () => {
    const merged = mergeContactsFormTabsFromApi(undefined, [getContactSeedFormTab("basic")!]);
    expect(merged.map((tab) => tab.key)).toContain("basic");
    expect(merged.find((tab) => tab.key === "basic")?.label).toBe(
      DEFAULT_FORM_TABS.find((tab) => tab.key === "basic")?.label,
    );
  });
});
