import { test } from "node:test";
import assert from "node:assert/strict";
import { findWildcardProjections, stripComments } from "./db-projections-core.mjs";

test("detects a one-line wildcard projection", () => {
  assert.equal(findWildcardProjections("const rows = db.select().from(users);").length, 1);
});

test("detects a multi-line wildcard projection", () => {
  const source = ["db", "  .select()", "  .from(users)"].join("\n");
  assert.equal(findWildcardProjections(source).length, 1);
});

test("detects a wildcard split by a comment", () => {
  const source = ["db.select()", "  // keep this projection", "  .from(users)"].join("\n");
  assert.equal(findWildcardProjections(source).length, 1);
});

test("does not flag an explicit projection", () => {
  assert.equal(findWildcardProjections("db.select({ id: users.id }).from(users);").length, 0);
});

test("ignores commented-out wildcard projections", () => {
  const source = ["// const rows = db.select().from(users);", "/* db.select().from(users) */"].join(
    "\n",
  );
  assert.equal(findWildcardProjections(source).length, 0);
});

test("stripComments preserves line numbers", () => {
  const source = ["const a = 1;", "/* two", "lines */", "const b = 2;"].join("\n");
  assert.equal(stripComments(source).split("\n").length, 4);
});
