import { describe, expect, it } from "vitest";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@/lib/query/dynamicWidgetAggregatesQueryKey";
import {
  HASANAT_DENOMS_QUERY_KEY,
  HASANAT_METRICS_QUERY_KEY,
  HASANAT_REDEMPTIONS_QUERY_KEY,
  HASANAT_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/hasanat/hooks/hasanatQueryKeys";
import { HASANAT_PREFERENCES_QUERY_KEY as PREFS } from "@/tenant/features/hasanat/hooks/useHasanatSetupConfig";
import {
  invalidateHasanatQueries,
  invalidateHasanatSetupQueries,
  invalidateHasanatWorkQueries,
} from "./invalidateHasanatQueries";

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

const includes = (keys: unknown[][], target: readonly unknown[]) =>
  keys.some((key) => target.every((part, index) => key[index] === part));

describe("hasanat query invalidation policy", () => {
  it("work writes refresh cards, the ledger, metrics and dashboard widgets — not setup", () => {
    const { client, keys } = capture();
    invalidateHasanatWorkQueries(client);

    expect(includes(keys, HASANAT_REDEMPTIONS_QUERY_KEY)).toBe(true);
    expect(includes(keys, HASANAT_METRICS_QUERY_KEY)).toBe(true);
    expect(includes(keys, HASANAT_REPORT_AGGREGATES_QUERY_KEY)).toBe(true);
    expect(includes(keys, DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY)).toBe(true);
    // Awarding points cannot change the tenant's setup preferences.
    expect(includes(keys, PREFS)).toBe(false);
  });

  it("setup writes refresh the catalogue and preferences", () => {
    const { client, keys } = capture();
    invalidateHasanatSetupQueries(client);

    expect(includes(keys, PREFS)).toBe(true);
    expect(includes(keys, HASANAT_DENOMS_QUERY_KEY)).toBe(true);
    expect(includes(keys, DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY)).toBe(true);
    expect(includes(keys, HASANAT_REDEMPTIONS_QUERY_KEY)).toBe(false);
  });

  it("the live-push union still refreshes everything", () => {
    const { client, keys } = capture();
    invalidateHasanatQueries(client);

    expect(includes(keys, HASANAT_REDEMPTIONS_QUERY_KEY)).toBe(true);
    expect(includes(keys, PREFS)).toBe(true);
    expect(includes(keys, DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY)).toBe(true);
  });
});
