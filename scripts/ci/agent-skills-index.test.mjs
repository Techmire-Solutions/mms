import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { findDrift, ruleNames, skillNames, workflowNames } from "../check-agent-skills-index.mjs";

const tempDirs = [];
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mms-agent-index-"));
  tempDirs.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function withRoots(root) {
  // The gate reads fixed paths from ROOT; the pure functions accept explicit dirs, so the fixtures below
  // exercise those directly and the repository case is asserted by the gate itself.
  return {
    skills: skillNames(path.join(root, ".agent", "skills")),
    rules: ruleNames(path.join(root, ".cursor", "rules")),
  };
}

describe("agent guide drift gate", () => {
  it("lists only directories that actually contain a SKILL.md", () => {
    const root = fixture({
      ".agent/skills/alpha/SKILL.md": "# alpha\n",
      ".agent/skills/beta/SKILL.md": "# beta\n",
      ".agent/skills/not-a-skill/README.md": "no skill here\n",
      ".cursor/rules/one.mdc": "---\n---\n",
      ".cursor/rules/two.mdc": "---\n---\n",
      ".cursor/rules/ignored.md": "mirror\n",
    });
    const { skills, rules } = withRoots(root);
    assert.deepEqual(skills, ["alpha", "beta"]);
    assert.deepEqual(rules, ["one", "two"]);
  });

  it("the repository's own guides are in sync", () => {
    assert.deepEqual(findDrift(), []);
  });

  it("reports a name the guides omit, without needing the files on disk", () => {
    // A name that cannot be in the guide (this test once used `mms-contacts`, which the gate then found
    // me adding — a self-invalidating fixture).
    const injected = "zzz-not-a-real-skill";
    const drift = findDrift({ skills: ["alpha", injected], rules: ruleNames() });
    assert.ok(
      drift.some((entry) => entry.includes(injected)),
      `expected the omitted skill to be reported, got: ${drift.join(" | ")}`,
    );
  });

  it("reports a count that disagrees with the corpus", () => {
    const drift = findDrift({ skills: ["alpha"], rules: ruleNames() });
    assert.ok(
      drift.some((entry) => /Skills \(\d+\) but 1 exist/.test(entry)),
      `expected a count mismatch, got: ${drift.join(" | ")}`,
    );
  });
});

describe("workflow coverage", () => {
  it("lists every workflow markdown file on disk", () => {
    const names = workflowNames();
    assert.ok(names.length > 0, "expected the repository to have workflows");
    assert.ok(names.includes("code-review"));
    assert.ok(!names.includes("README"), "README is not a workflow");
  });

  it("reports a workflow AGENTS.md does not mention", () => {
    const drift = findDrift({ workflows: ["zzz-not-a-real-workflow"] });
    assert.ok(
      drift.some((entry) => entry.includes("zzz-not-a-real-workflow")),
      `expected the unlisted workflow to be reported, got: ${drift.join(" | ")}`,
    );
  });
});
