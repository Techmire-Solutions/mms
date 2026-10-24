import { describe, expect, it } from "vitest";
import { VENDOR_CHUNK_GROUPS, manualVendorChunk, rolldownChunkGroups } from "./vendorChunks";

describe("vendorChunks SSOT", () => {
  it("keeps chunk names unique", () => {
    const names = VENDOR_CHUNK_GROUPS.map((group) => group.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("derives the Rolldown groups from the same table (no drift)", () => {
    expect(rolldownChunkGroups().map((group) => group.name)).toEqual(
      VENDOR_CHUNK_GROUPS.map((group) => group.name),
    );
    // Same regex/priority instances — the two configs cannot diverge.
    rolldownChunkGroups().forEach((group, index) => {
      expect(group.test).toBe(VENDOR_CHUNK_GROUPS[index].test);
      expect(group.priority).toBe(VENDOR_CHUNK_GROUPS[index].priority);
    });
  });

  it("maps representative module ids to their vendor chunk", () => {
    const cases: Array<[string, string]> = [
      ["/repo/node_modules/react/index.js", "vendor-react"],
      ["/repo/node_modules/react-dom/client.js", "vendor-react"],
      ["/repo/node_modules/react-router-dom/dist/index.js", "vendor-react"],
      ["/repo/node_modules/@tanstack/react-query/build/index.js", "vendor-query"],
      ["/repo/node_modules/@tanstack/react-virtual/dist/index.js", "vendor-virtual"],
      ["/repo/node_modules/react-easy-crop/index.js", "vendor-crop"],
      ["/repo/node_modules/@radix-ui/react-slot/dist/index.js", "vendor-ui"],
      ["/repo/node_modules/lucide-react/dist/lucide-react.js", "vendor-ui"],
      ["/repo/node_modules/framer-motion/dist/index.js", "vendor-motion"],
      ["/repo/node_modules/recharts/es6/index.js", "vendor-charts"],
      ["/repo/node_modules/d3-scale/src/index.js", "vendor-charts"],
      ["/repo/node_modules/zod/v4/index.js", "vendor-validation"],
      ["/repo/node_modules/@ts-rest/core/index.js", "vendor-validation"],
      ["/repo/packages/shared/dist/i18n/appTranslationsEn.js", "mms-i18n-en"],
      ["/repo/packages/shared/dist/i18n/appTranslationsAr.js", "mms-i18n-ar"],
      ["/repo/packages/shared/dist/i18n/appTranslationsUr.js", "mms-i18n-ur"],
      ["/repo/packages/shared/dist/i18n/appTranslationsFa.js", "mms-i18n-fa"],
    ];
    for (const [id, expected] of cases) {
      expect(manualVendorChunk(id), id).toBe(expected);
    }
  });

  it("handles Windows path separators", () => {
    expect(manualVendorChunk("C:\\repo\\node_modules\\react\\index.js")).toBe("vendor-react");
    expect(manualVendorChunk("C:\\repo\\packages\\shared\\dist\\i18n\\appTranslationsEn.js")).toBe(
      "mms-i18n-en",
    );
  });

  it("returns undefined for app code and unmatched modules", () => {
    expect(manualVendorChunk("/repo/src/main.tsx")).toBeUndefined();
    expect(manualVendorChunk("/repo/node_modules/some-other-lib/index.js")).toBeUndefined();
  });
});
