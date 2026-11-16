import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../../.agent/scripts/sync-all.sh", import.meta.url), "utf8");
const LINES = SOURCE.split("\n");

test("sync-all.sh regenerates the skill indexes before mirroring skills", () => {
  const indexLine = LINES.findIndex((line) => line.includes("scripts/sync-skill-index.mjs"));
  assert.ok(indexLine >= 0, "sync-all.sh must run the skill index sync");

  for (const mirror of ["sync-rules.sh", "sync-skills.sh", "sync-claude.sh", "sync-dsh.sh"]) {
    const mirrorLine = LINES.findIndex((line) => line.includes(mirror) && line.includes("bash "));
    assert.ok(
      mirrorLine > indexLine,
      `${mirror} must run after the index sync (line order matters)`,
    );
  }
});

test("a dry run does not write the indexes", () => {
  const indexLine = LINES.findIndex((line) => line.includes("sync-skill-index.mjs"));
  // The index command must sit in the `else` branch of the DRY_RUN guard, so
  // `--dry-run` cannot mutate the manifest/README/AGENTS.md count.
  assert.equal(LINES[indexLine - 1]?.trim(), "else");
  assert.match(
    SOURCE.slice(0, SOURCE.indexOf("bash .agent/scripts/sync-rules.sh")),
    /Would sync the skill indexes/,
  );
});
