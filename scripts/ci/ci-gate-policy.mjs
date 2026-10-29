#!/usr/bin/env node
/**
 * CI gate policy checks that the inline result table cannot express.
 *
 * A `skipped` job is legitimate when its path filter did not match, or while a
 * PR is still a draft. It is NOT legitimate on a ready PR whose paths matched:
 * that is how a PR could merge with zero DB/E2E coverage. Likewise a failed
 * `changes` job empties every downstream output, so all test jobs skip and the
 * aggregate check would otherwise stay green.
 *
 * Inputs (env): EVENT_NAME, IS_DRAFT, TEST_SCOPE, CHANGES_RESULT,
 * DB_MATCHED, DB_RESULT, E2E_MATCHED, E2E_RESULT, RLS_MATCHED, RLS_RESULT.
 */
import process from "node:process";

/**
 * @typedef {object} GatePolicyInput
 * @property {string} eventName
 * @property {boolean} isDraft
 * @property {string} testScope
 * @property {string} changesResult
 * @property {boolean} dbMatched
 * @property {string} dbResult
 * @property {boolean} e2eMatched
 * @property {string} e2eResult
 * @property {boolean} rlsMatched
 * @property {string} rlsResult
 */

/**
 * @param {GatePolicyInput} input
 * @returns {string[]} failure messages (empty = pass)
 */
export function evaluateCiGatePolicy(input) {
  const failures = [];

  if (input.changesResult !== "success") {
    failures.push(
      `changes job ${input.changesResult || "missing"} — path/test-scope outputs are unreliable`,
    );
  }

  if (input.eventName === "pull_request") {
    if (!input.testScope) {
      failures.push("test scope is empty on a pull request (changes job did not produce a scope)");
    }

    if (!input.isDraft) {
      if (input.dbMatched && input.dbResult === "skipped") {
        failures.push("backend DB tests were skipped on a ready PR whose paths matched");
      }
      if (input.e2eMatched && input.e2eResult === "skipped") {
        failures.push("E2E tests were skipped on a ready PR whose paths matched");
      }
      if (input.rlsMatched && input.rlsResult === "skipped") {
        failures.push("RLS enforcement tests were skipped on a ready PR whose paths matched");
      }
    }
  }

  return failures;
}

function main() {
  const env = process.env;
  const failures = evaluateCiGatePolicy({
    eventName: env.EVENT_NAME ?? "",
    isDraft: env.IS_DRAFT === "true",
    testScope: env.TEST_SCOPE ?? "",
    changesResult: env.CHANGES_RESULT ?? "",
    dbMatched: env.DB_MATCHED === "true",
    dbResult: env.DB_RESULT ?? "",
    e2eMatched: env.E2E_MATCHED === "true",
    e2eResult: env.E2E_RESULT ?? "",
    rlsMatched: env.RLS_MATCHED === "true",
    rlsResult: env.RLS_RESULT ?? "",
  });

  for (const failure of failures) console.error(`::error::${failure}`);
  if (failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
