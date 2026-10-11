import { describe, expect, it } from "vitest";
import { matchesWildcardSearch, toSqlSearchPattern } from "../searchPatternUtils.js";

describe("searchPatternUtils", () => {
  describe("toSqlSearchPattern", () => {
    it("returns % for empty or null search", () => {
      expect(toSqlSearchPattern("")).toBe("%");
      expect(toSqlSearchPattern(null)).toBe("%");
      expect(toSqlSearchPattern("   ")).toBe("%");
    });

    it("wraps standard terms in % for substring matching", () => {
      expect(toSqlSearchPattern("ahmed")).toBe("%ahmed%");
      expect(toSqlSearchPattern("  fatima  ")).toBe("%fatima%");
    });

    it("converts * to % and ? to _", () => {
      expect(toSqlSearchPattern("ahm*")).toBe("ahm%");
      expect(toSqlSearchPattern("*med")).toBe("%med");
      expect(toSqlSearchPattern("ahm?d")).toBe("ahm_d");
    });

    it("handles multiple wildcards", () => {
      expect(toSqlSearchPattern("*ahm?d*")).toBe("%ahm_d%");
      expect(toSqlSearchPattern("a*b?c*")).toBe("a%b_c%");
    });
  });

  describe("matchesWildcardSearch", () => {
    it("returns true for empty search term", () => {
      expect(matchesWildcardSearch("Any text", "")).toBe(true);
      expect(matchesWildcardSearch("Any text", "   ")).toBe(true);
    });

    it("performs substring match when no wildcards present", () => {
      expect(matchesWildcardSearch("Ahmed Khan", "khan")).toBe(true);
      expect(matchesWildcardSearch("Ahmed Khan", "ali")).toBe(false);
    });

    it("matches with * wildcard (0 or more chars)", () => {
      expect(matchesWildcardSearch("Ahmed Khan", "ahm*")).toBe(true);
      expect(matchesWildcardSearch("Ahmed Khan", "*khan")).toBe(true);
      expect(matchesWildcardSearch("Ahmed Khan", "a*k*n")).toBe(true);
      expect(matchesWildcardSearch("Ahmed Khan", "z*k")).toBe(false);
    });

    it("matches with ? wildcard (single char)", () => {
      expect(matchesWildcardSearch("Ahmed", "ahm?d")).toBe(true);
      expect(matchesWildcardSearch("Ahmid", "ahm?d")).toBe(true);
      expect(matchesWildcardSearch("Ahmxd", "ahm?d")).toBe(true);
      expect(matchesWildcardSearch("Ahmedd", "ahm?d")).toBe(false);
    });
  });
});
