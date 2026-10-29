import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRlsDeployPolicy } from "./rls-deploy-policy.mjs";

const base = { mode: "strict", allowWarn: "0", allowOff: "0" };

test("strict is always allowed", () => {
  assert.deepEqual(evaluateRlsDeployPolicy(base), { allowed: true });
});

test("warn is rejected without the explicit override", () => {
  const decision = evaluateRlsDeployPolicy({ ...base, mode: "warn" });
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /MMS_ALLOW_RLS_WARN=1/);
});

test("warn is allowed with MMS_ALLOW_RLS_WARN=1", () => {
  const decision = evaluateRlsDeployPolicy({ ...base, mode: "warn", allowWarn: "1" });
  assert.equal(decision.allowed, true);
});

test("off is rejected without the explicit override", () => {
  const decision = evaluateRlsDeployPolicy({ ...base, mode: "off" });
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /MMS_ALLOW_RLS_OFF=1/);
});

test("off is allowed with MMS_ALLOW_RLS_OFF=1", () => {
  const decision = evaluateRlsDeployPolicy({ ...base, mode: "off", allowOff: "1" });
  assert.equal(decision.allowed, true);
});

test("unknown and empty modes fail closed", () => {
  assert.equal(evaluateRlsDeployPolicy({ ...base, mode: "disabled" }).allowed, false);
  assert.equal(evaluateRlsDeployPolicy({ ...base, mode: "" }).allowed, false);
});

test("only the literal 1 counts as an override", () => {
  assert.equal(
    evaluateRlsDeployPolicy({ ...base, mode: "warn", allowWarn: "true" }).allowed,
    false,
  );
  assert.equal(evaluateRlsDeployPolicy({ ...base, mode: "off", allowOff: "yes" }).allowed, false);
});
