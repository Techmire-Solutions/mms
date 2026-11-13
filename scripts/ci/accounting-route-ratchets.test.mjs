import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ACCOUNTING_ROUTE_ACTIONS,
  DENIED_ROLES_BY_ACTION,
  classifyAccountingRoute,
  routeMatcher,
} from "../lib/accountingRouteClassification.mjs";

test("classifies GET routes as read", () => {
  assert.equal(
    classifyAccountingRoute({ method: "GET", path: "/api/accounting/accounts" }),
    "read",
  );
  assert.equal(classifyAccountingRoute({ method: "GET", path: "/api/accounting/ledger" }), "read");
});

test("classifies the controller-level overrides as manage", () => {
  for (const routePath of [
    "/api/accounting/posting-periods/:id/close",
    "/api/accounting/posting-periods/:id/reopen",
    "/api/accounting/fiscal-years/:id/close",
    "/api/accounting/entries/:id/reverse",
    "/api/accounting/fx-revaluations",
    "/api/accounting/ias29-restatements",
    "/api/accounting/opening-balances/:fiscalYearId/post",
    "/api/accounting/voucher-numbering",
  ]) {
    const method = routePath === "/api/accounting/voucher-numbering" ? "PUT" : "POST";
    assert.equal(classifyAccountingRoute({ method, path: routePath }), "manage", routePath);
  }
});

test("classifies setup-write routes as manage-tier and archiving as delete", () => {
  for (const routePath of [
    "/api/accounting/currency-settings",
    "/api/accounting/currency-exchangeability",
    "/api/accounting/hyperinflation-settings",
    "/api/accounting/field-config",
    "/api/accounting/preferences",
  ]) {
    assert.equal(
      classifyAccountingRoute({ method: "PUT", path: routePath }),
      "setupWrite",
      routePath,
    );
  }
  assert.equal(
    classifyAccountingRoute({ method: "DELETE", path: "/api/accounting/entries/:id" }),
    "delete",
  );
  assert.equal(
    classifyAccountingRoute({ method: "POST", path: "/api/accounting/entries/bulk-delete" }),
    "delete",
  );
});

test("classifies read-shaped POSTs as read and the rest as write", () => {
  for (const routePath of [
    "/api/accounting/fx-revaluations/preview",
    "/api/accounting/ias29-restatements/preview",
    "/api/accounting/hedges/:id/valuations/preview",
    "/api/accounting/reports/pdf",
    "/api/accounting/reports/ledger/export",
  ]) {
    assert.equal(classifyAccountingRoute({ method: "POST", path: routePath }), "read", routePath);
  }
  assert.equal(
    classifyAccountingRoute({ method: "POST", path: "/api/accounting/hedges/:id/valuations" }),
    "write",
  );
});

test("every action denies at least one role and never denies admin", () => {
  for (const action of ACCOUNTING_ROUTE_ACTIONS) {
    const denied = DENIED_ROLES_BY_ACTION[action];
    assert.ok(denied.length > 0, action);
    assert.ok(!denied.includes("admin"), action);
  }
  assert.deepEqual(DENIED_ROLES_BY_ACTION.read, ["guardian"]);
  assert.deepEqual(DENIED_ROLES_BY_ACTION.write, ["auditor", "guardian"]);
});

test("route matcher tolerates placeholders, query strings and template interpolation", () => {
  const matcher = routeMatcher("/api/accounting/entries/:id");
  assert.ok(matcher.test("/api/accounting/entries/probe-id"));
  assert.ok(matcher.test("/api/accounting/entries/abc?tab=1"));
  assert.ok(!matcher.test("/api/accounting/accounts/abc"));
});

test("the checked-in matrix covers every contract route with the library's classification", () => {
  const root = process.cwd();
  const contractDir = path.join(root, "packages/shared/src/contracts");
  const routes = new Set();
  for (const name of fs.readdirSync(contractDir).filter((f) => /^accounting.*\.ts$/.test(f))) {
    const source = fs.readFileSync(path.join(contractDir, name), "utf8");
    const re =
      /method:\s*"(GET|POST|PUT|DELETE|PATCH)"(?:[\s\S]{0,200}?)path:\s*"(\/api\/accounting[^"]+)"/g;
    let match;
    while ((match = re.exec(source))) routes.add(`${match[1]} ${match[2]}`);
  }
  const matrix = JSON.parse(
    fs.readFileSync(path.join(root, "scripts/ci/accounting-route-security.json"), "utf8"),
  );
  assert.equal(Object.keys(matrix).length, routes.size);
  for (const key of routes) {
    const entry = matrix[key];
    assert.ok(entry, `missing classification: ${key}`);
    const [method, routePath] = key.split(" ");
    assert.equal(entry.action, classifyAccountingRoute({ method, path: routePath }), key);
    assert.deepEqual(entry.deniedRoles, DENIED_ROLES_BY_ACTION[entry.action], key);
  }
});
