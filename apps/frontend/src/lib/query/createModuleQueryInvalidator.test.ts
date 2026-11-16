import { describe, expect, it } from "vitest";
import { createModuleQueryInvalidator } from "./createModuleQueryInvalidator";

/** The invalidator only needs `invalidateQueries`; capture the key prefixes it asks for. */
function capture() {
  const keys: unknown[][] = [];
  const client = {
    invalidateQueries: (args: { queryKey: readonly unknown[] }) => {
      keys.push([...args.queryKey]);
      return Promise.resolve();
    },
  } as never;
  return { client, keys };
}

describe("createModuleQueryInvalidator", () => {
  const invalidate = createModuleQueryInvalidator({
    list: ["mod", "list"],
    lists: [["mod", "other-list"]],
    count: ["mod", "count"],
    metrics: ["mod", "metrics"],
    reports: ["mod", "report-aggregates"],
    widgetAggregates: ["mod", "widget-aggregates"],
    preferences: ["mod", "preferences"],
    lookups: ["mod", "lookups"],
    related: [
      ["accounting", "entries"],
      ["accounting", "report-aggregates"],
    ],
    dashboard: ["dashboard", "summary"],
  });

  it("invalidates every declared family, including related and dashboard keys", () => {
    const { client, keys } = capture();
    invalidate(client);

    const expected = [
      ["mod", "list"],
      ["mod", "other-list"],
      ["mod", "count"],
      ["mod", "metrics"],
      ["mod", "report-aggregates"],
      ["mod", "widget-aggregates"],
      ["mod", "preferences"],
      ["mod", "lookups"],
      ["accounting", "entries"],
      ["accounting", "report-aggregates"],
      ["dashboard", "summary"],
    ];
    for (const key of expected) {
      expect(keys, `missing ${JSON.stringify(key)}`).toContainEqual(key);
    }
  });

  it("invalidates related keys after lookups and before the dashboard", () => {
    const { client, keys } = capture();
    invalidate(client);

    const indexOf = (key: unknown[]) =>
      keys.findIndex((candidate) => candidate.join("/") === key.join("/"));
    expect(indexOf(["accounting", "entries"])).toBeGreaterThan(indexOf(["mod", "lookups"]));
    expect(indexOf(["dashboard", "summary"])).toBeGreaterThan(
      indexOf(["accounting", "report-aggregates"]),
    );
  });

  it("keeps related optional", () => {
    const { client, keys } = capture();
    createModuleQueryInvalidator({
      list: ["bare", "list"],
      metrics: ["bare", "metrics"],
    })(client);

    expect(keys).toEqual([
      ["bare", "list"],
      ["bare", "metrics"],
    ]);
  });
});
