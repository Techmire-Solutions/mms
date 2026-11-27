import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Workspace-day guard for form defaults that previously used the device clock
 * (`todayISO()` = `formatDateToIso(new Date())`). A device in another zone can name
 * the wrong day, while the server gates on the workspace timezone.
 *
 * Surfaces are listed either app-relative (`src/<path>`) or repo-relative for code that
 * moved into a module package; `resolve()` tries both and fails closed when neither
 * exists, so a move cannot silently drop a file from this guard.
 */
const APP_ROOT = join(import.meta.dirname, "..", "..", "..");
const REPO_ROOT = join(APP_ROOT, "..", "..");
// Both consoles share this guard, so resolve against both app roots as well as the repo root
// (the platform app carries no tenant tree after the P14 prune).
const CONSOLE_SRC = ["tenant-web", "platform-web"].map((app) =>
  join(REPO_ROOT, "apps", app, "src"),
);

const FILES = [
  "packages/modules/hasanat/src/frontend/tenant/components/DistributeModal.tsx",
  "packages/modules/hasanat/src/frontend/tenant/components/RedeemModal.tsx",
  "packages/modules/hasanat/src/frontend/tenant/components/StockAddBatchModal.tsx",
  "packages/modules/attendance/src/frontend/tenant/components/AttendanceRegisterExport.tsx",
];

function resolve(file: string): string {
  const candidate = [
    join(APP_ROOT, "src", file),
    ...CONSOLE_SRC.map((src) => join(src, file)),
    join(REPO_ROOT, file),
  ].find((candidatePath) => existsSync(candidatePath));
  if (!candidate) {
    throw new Error(`workspace-day guard: source not found for ${file}`);
  }
  return candidate;
}

describe("form defaults use the workspace day", () => {
  for (const file of FILES) {
    it(`${file} uses useWorkspaceToday and no device-clock todayISO()`, () => {
      const source = readFileSync(resolve(file), "utf8");
      expect(source).toContain('useWorkspaceToday"');
      expect(source).not.toMatch(/todayISO\(\)/);
    });
  }
});
