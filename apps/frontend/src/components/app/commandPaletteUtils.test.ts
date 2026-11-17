import { beforeEach, describe, expect, it } from "vitest";
import {
  getRecents,
  pushRecent,
  trigramScore,
  filterCommandItems,
  RECENTS_KEY,
} from "./commandPaletteUtils";
import type { CommandItem } from "./commandPaletteItems";

describe("commandPaletteUtils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getRecents and pushRecent", () => {
    it("returns empty array when nothing is stored", () => {
      expect(getRecents()).toEqual([]);
    });

    it("persists pushed item and puts most recent first", () => {
      pushRecent("students");
      pushRecent("finance");
      expect(getRecents()).toEqual(["finance", "students"]);
    });

    it("deduplicates existing entries when pushed again", () => {
      pushRecent("students");
      pushRecent("finance");
      pushRecent("students");
      expect(getRecents()).toEqual(["students", "finance"]);
    });

    it("caps recents list to 5 items", () => {
      ["1", "2", "3", "4", "5", "6"].forEach(pushRecent);
      const recents = getRecents();
      expect(recents).toHaveLength(5);
      expect(recents[0]).toBe("6");
    });

    it("gracefully handles invalid JSON in localStorage", () => {
      localStorage.setItem(RECENTS_KEY, "invalid-json");
      expect(getRecents()).toEqual([]);
    });
  });

  describe("trigramScore", () => {
    it("returns 0 for empty query", () => {
      expect(trigramScore("anything", "")).toBe(0);
    });

    it("returns 1 for exact match", () => {
      expect(trigramScore("Accounting", "accounting")).toBe(1.0);
    });

    it("returns 0.8 for substring match", () => {
      expect(trigramScore("Students Directory", "student")).toBe(0.8);
    });

    it("computes high score for minor typo", () => {
      const score = trigramScore("Attendance", "attandance");
      expect(score).toBeGreaterThan(0.5);
    });

    it("scores low for unrelated string sharing only suffix", () => {
      const score = trigramScore("settings", "accounting");
      expect(score).toBeLessThan(0.4);
    });
  });

  describe("filterCommandItems", () => {
    const dummyItems: CommandItem[] = [
      {
        id: "students",
        labelKey: "nav.students",
        categoryKey: "nav.modules",
        path: "/students",
        icon: () => null,
        keywords: ["learners", "pupils"],
      },
      {
        id: "accounting",
        labelKey: "nav.accounting",
        categoryKey: "nav.modules",
        path: "/accounting",
        icon: () => null,
        keywords: ["ledger", "journal"],
      },
    ];

    const translate = (key: string) =>
      ({ "nav.students": "Students", "nav.accounting": "Accounting" })[key] ?? "";

    it("returns all items when query is empty", () => {
      const res = filterCommandItems(dummyItems, "", () => "");
      expect(res).toHaveLength(2);
    });

    it("filters by translated label", () => {
      const res = filterCommandItems(dummyItems, "student", translate);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("students");
    });

    it("filters by keyword", () => {
      const res = filterCommandItems(dummyItems, "ledger", translate);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("accounting");
    });

    it("matches a terminology-resolved label supplied by translate", () => {
      const terminologyTranslate = (key: string) =>
        key === "nav.students" ? "Guests & Patrons" : key === "nav.accounting" ? "Accounting" : "";
      const res = filterCommandItems(dummyItems, "guests", terminologyTranslate);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("students");
    });

    it("returns empty array when query does not match", () => {
      const res = filterCommandItems(dummyItems, "zzzzzzzz", translate);
      expect(res).toHaveLength(0);
    });
  });
});
