import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Workspace-day guard for form defaults that previously used the device clock
 * (`todayISO()` = `formatDateToIso(new Date())`). A device in another zone can name
 * the wrong day, while the server gates on the workspace timezone.
 */
const FILES = [
  "tenant/features/hasanat/components/DistributeModal.tsx",
  "tenant/features/hasanat/components/RedeemModal.tsx",
  "tenant/features/hasanat/components/StockAddBatchModal.tsx",
  "tenant/features/attendance/components/AttendanceRegisterExport.tsx",
];

describe("form defaults use the workspace day", () => {
  for (const file of FILES) {
    it(`${file} uses useWorkspaceToday and no device-clock todayISO()`, () => {
      const source = readFileSync(join(process.cwd(), "src", file), "utf8");
      expect(source).toContain('useWorkspaceToday"');
      expect(source).not.toMatch(/todayISO\(\)/);
    });
  }
});
