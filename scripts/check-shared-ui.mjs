#!/usr/bin/env node
/**
 * Thin wrapper over the canonical Shared UI governance script.
 *
 * The implementation lives in `.agent/skills/mms-shared-ui/scripts/check-shared-ui.mjs`
 * because the skill, the rule, and the `/shared-ui-audit` workflow all cite that path.
 * Keeping a second copy here previously drifted (13 banned primitive names existed only
 * in this file), so this wrapper only forwards argv and the exit code.
 *
 * Usage: node scripts/check-shared-ui.mjs [--json]
 * Norms: mms-shared-ui.md · mms-dry.md §1 · mms-ui-ux-design.md §1.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, "..", ".agent/skills/mms-shared-ui/scripts/check-shared-ui.mjs");

const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: "inherit",
});
if (result.error) {
  console.error(`Unable to run ${target}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
