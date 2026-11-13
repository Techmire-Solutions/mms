import { describe, expect, it } from "vitest";
import {
  ACCOUNT_HIERARCHY_MAX_DEPTH,
  accountAncestorIds,
  checkAccountParent,
  describeAccountHierarchyViolation,
  summaryAccountIds,
  type AccountHierarchyNode,
} from "./accountingAccountHierarchy.js";

const nodes = (rows: Array<[id: string, parentId?: string, deletedAt?: string]>) =>
  rows.map(([id, parentId, deletedAt]) => ({ id, parentId: parentId ?? null, deletedAt }));

const chart = nodes([
  ["a1000", undefined],
  ["a1100", "a1000"],
  ["a1110", "a1100"],
  ["a2000", undefined],
  ["a9000", undefined, "2026-02-01T00:00:00.000Z"],
]);

describe("chart-of-accounts hierarchy", () => {
  it("accepts a root account and a valid child", () => {
    expect(checkAccountParent(chart, "a1200", null).ok).toBe(true);
    expect(checkAccountParent(chart, "a1200", "a1100").chain).toEqual(["a1100", "a1000"]);
  });

  it("rejects an account as its own parent", () => {
    expect(checkAccountParent(chart, "a1100", "a1100")).toMatchObject({
      ok: false,
      violation: "self_parent",
    });
  });

  it("rejects an unknown or archived parent", () => {
    expect(checkAccountParent(chart, "a1200", "missing")).toMatchObject({
      violation: "unknown_parent",
    });
    expect(checkAccountParent(chart, "a1200", "a9000")).toMatchObject({
      violation: "archived_parent",
    });
  });

  it("rejects a cycle, including the indirect one a reparent would create", () => {
    // a1000 -> a1110 would close a1000 → a1100 → a1110 → a1000.
    expect(checkAccountParent(chart, "a1000", "a1110")).toMatchObject({ violation: "cycle" });
  });

  it("terminates on a chart that already loops instead of hanging", () => {
    const looping = nodes([
      ["x", "y"],
      ["y", "x"],
    ]);
    expect(checkAccountParent(looping, "child", "x")).toMatchObject({ violation: "cycle" });
  });

  it("bounds the depth at the documented maximum", () => {
    const deep: AccountHierarchyNode[] = [];
    for (let level = 0; level <= ACCOUNT_HIERARCHY_MAX_DEPTH; level += 1) {
      deep.push({ id: `n${level}`, parentId: level === 0 ? null : `n${level - 1}` });
    }
    // 9 ancestors (> 8) is rejected; 8 is accepted.
    expect(checkAccountParent(deep, "leaf", `n${ACCOUNT_HIERARCHY_MAX_DEPTH}`)).toMatchObject({
      violation: "too_deep",
    });
    expect(checkAccountParent(deep, "leaf", `n${ACCOUNT_HIERARCHY_MAX_DEPTH - 1}`).ok).toBe(true);
  });

  it("reports the ancestor chain without looping forever", () => {
    expect(accountAncestorIds(chart, "a1110")).toEqual(["a1100", "a1000"]);
    expect(
      accountAncestorIds(
        nodes([
          ["x", "y"],
          ["y", "x"],
        ]),
        "x",
      ),
    ).toEqual(["y"]);
  });

  it("describes each violation for the API and the UI", () => {
    expect(
      describeAccountHierarchyViolation("self_parent", { accountId: "a1", parentId: "a1" }),
    ).toContain("own parent");
    expect(
      describeAccountHierarchyViolation("archived_parent", { accountId: "a1", parentId: "a9" }),
    ).toContain("archived");
    expect(
      describeAccountHierarchyViolation("cycle", {
        accountId: "a1",
        parentId: "a2",
        chain: ["a2", "a1"],
      }),
    ).toContain("a2 → a1");
  });
});

describe("summary (header) accounts", () => {
  it("marks every account that hosts an active child", () => {
    const rows = nodes([
      ["root", undefined],
      ["child", "root"],
      ["grandchild", "child"],
      ["leaf", undefined],
    ]);
    expect([...summaryAccountIds(rows)].sort()).toEqual(["child", "root"]);
  });

  it("does not mark a parent whose only children are archived", () => {
    const rows = nodes([
      ["root", undefined],
      ["child", "root", "2026-02-01T00:00:00.000Z"],
    ]);
    expect(summaryAccountIds(rows).has("root")).toBe(false);
  });

  it("ignores a dangling parent reference", () => {
    expect(summaryAccountIds(nodes([["orphan", "missing"]])).size).toBe(0);
  });
});
