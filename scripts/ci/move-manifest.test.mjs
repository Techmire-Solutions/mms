import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMoveManifest } from "../check-move-manifest.mjs";

/** Build a manifest and an existence oracle from a set of existing paths. */
const check = (entries, existing = []) => {
  const set = new Set(existing);
  return validateMoveManifest(
    { version: 1, entries },
    { pathExists: (repoRelative) => set.has(repoRelative) },
  );
};

test("accepts an empty ledger", () => {
  const result = check([]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.summary, {});
});

test("accepts a consistent todo entry", () => {
  const result = check(
    [
      {
        from: "apps/api/src/contacts",
        to: "packages/modules/contacts/src/backend",
        phase: "P4",
        status: "todo",
      },
    ],
    ["apps/api/src/contacts"],
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.summary, { P4: { total: 1, done: 0 } });
});

test("accepts a consistent done entry", () => {
  const result = check(
    [
      {
        from: "apps/api/src/contacts",
        to: "packages/modules/contacts/src/backend",
        phase: "P4",
        status: "done",
      },
    ],
    ["packages/modules/contacts/src/backend"],
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.summary, { P4: { total: 1, done: 1 } });
});

test("rejects a done entry whose source still exists", () => {
  const result = check(
    [
      {
        from: "apps/api/src/contacts",
        to: "packages/modules/contacts/src/backend",
        phase: "P4",
        status: "done",
      },
    ],
    ["apps/api/src/contacts", "packages/modules/contacts/src/backend"],
  );
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /still exists/);
});

test("rejects a done entry whose target is missing", () => {
  const result = check(
    [
      {
        from: "apps/api/src/contacts",
        to: "packages/modules/contacts/src/backend",
        phase: "P4",
        status: "done",
      },
    ],
    [],
  );
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /does not exist/);
});

test("rejects a todo entry whose source is missing", () => {
  const result = check(
    [
      {
        from: "apps/api/src/contacts",
        to: "packages/modules/contacts/src/backend",
        phase: "P4",
        status: "todo",
      },
    ],
    [],
  );
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /"todo" but apps\/api\/src\/contacts does not exist/);
});

test("rejects a todo entry whose target already exists (stale status)", () => {
  const result = check(
    [
      {
        from: "apps/api/src/contacts",
        to: "packages/modules/contacts/src/backend",
        phase: "P4",
        status: "todo",
      },
    ],
    ["apps/api/src/contacts", "packages/modules/contacts/src/backend"],
  );
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /flip status to "done"/);
});

test("rejects duplicates and self-nesting", () => {
  const result = check(
    [
      { from: "a", to: "b", phase: "P1", status: "todo" },
      { from: "a", to: "c", phase: "P1", status: "todo" },
      { from: "d", to: "b", phase: "P1", status: "todo" },
      { from: "e", to: "e/inner", phase: "P1", status: "todo" },
    ],
    ["a", "d", "e"],
  );
  const messages = result.errors.join("\n");
  assert.match(messages, /duplicates entries\[0\]\.from/);
  assert.match(messages, /duplicates entries\[0\]\.to/);
  assert.match(messages, /must not be inside/);
});

test("rejects malformed entries", () => {
  const result = validateMoveManifest(
    {
      version: 2,
      entries: [
        null,
        { from: "/abs", to: "b", phase: "P1", status: "todo" },
        { from: "a", to: "b", phase: "phase1", status: "shipped" },
        { from: "c\\d", to: "e/", phase: "P1", status: "todo" },
      ],
    },
    { pathExists: () => true },
  );
  assert.match(result.errors.join("\n"), /version must be 1/);
  assert.match(result.errors.join("\n"), /must be an object/);
  assert.match(result.errors.join("\n"), /must be repo-relative/);
  assert.match(result.errors.join("\n"), /phase must look like/);
  assert.match(result.errors.join("\n"), /status must be "todo" or "done"/);
  assert.match(result.errors.join("\n"), /POSIX separators/);
  assert.match(result.errors.join("\n"), /must not end with a slash/);
});

test("rejects a non-array entries field", () => {
  const result = validateMoveManifest({ version: 1, entries: {} }, { pathExists: () => true });
  assert.deepEqual(result.errors, ["manifest.entries must be an array"]);
});
