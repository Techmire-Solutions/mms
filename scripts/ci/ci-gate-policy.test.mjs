import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCiGatePolicy } from "./ci-gate-policy.mjs";

const base = {
  eventName: "pull_request",
  isDraft: false,
  testScope: "changed",
  changesResult: "success",
  dbMatched: true,
  dbResult: "success",
  e2eMatched: true,
  e2eResult: "success",
  rlsMatched: true,
  rlsResult: "success",
};

test("passes a normal ready PR", () => {
  assert.deepEqual(evaluateCiGatePolicy(base), []);
});

test("fails when the changes job failed", () => {
  assert.equal(evaluateCiGatePolicy({ ...base, changesResult: "failure" }).length, 1);
});

test("fails when a PR has no test scope", () => {
  assert.equal(evaluateCiGatePolicy({ ...base, testScope: "" }).length, 1);
});

test("allows skipped suites while the PR is a draft", () => {
  assert.deepEqual(
    evaluateCiGatePolicy({ ...base, isDraft: true, dbResult: "skipped", e2eResult: "skipped" }),
    [],
  );
});

test("fails when matched suites are skipped on a ready PR", () => {
  const failures = evaluateCiGatePolicy({
    ...base,
    dbResult: "skipped",
    e2eResult: "skipped",
    rlsResult: "skipped",
  });
  assert.equal(failures.length, 3);
});

test("allows a skipped suite when its path filter did not match", () => {
  assert.deepEqual(
    evaluateCiGatePolicy({
      ...base,
      dbMatched: false,
      dbResult: "skipped",
      e2eMatched: false,
      e2eResult: "skipped",
      rlsMatched: false,
      rlsResult: "skipped",
    }),
    [],
  );
});
