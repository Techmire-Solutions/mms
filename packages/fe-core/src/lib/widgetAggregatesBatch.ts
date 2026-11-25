import { WIDGET_AGGREGATES_MAX } from "@mms/contracts";
import { apiContractError } from "../api/contractError.js";

/**
 * Fans a list of widget queries out to the `/aggregates` endpoints in bounded
 * batches (the server caps each request at `WIDGET_AGGREGATES_MAX`). Without
 * this, a workspace with 33+ aggregate widgets overflows one request and the
 * server answers 400 — previously swallowed into zero-valued widgets (m11).
 */

export type WidgetAggregateResultEntry = {
  value?: number;
  totalCount?: number;
  chartData?: Array<{ name: string; value: number }>;
};

export function chunkWidgetQueries<T>(queries: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < queries.length; i += WIDGET_AGGREGATES_MAX) {
    chunks.push(queries.slice(i, i + WIDGET_AGGREGATES_MAX));
  }
  return chunks;
}

/**
 * Runs `request` once per ≤32-widget batch and merges the per-batch `results`
 * maps by widget id. Rejects on any non-200 response so a failed/overflowing
 * batch surfaces as a query error instead of silently resolving to `{}`.
 */
export async function fetchWidgetAggregatesBatched<TQuery>(
  queries: readonly TQuery[],
  request: (batch: TQuery[]) => Promise<{ status: number; body: unknown }>,
): Promise<Record<string, WidgetAggregateResultEntry>> {
  const merged: Record<string, WidgetAggregateResultEntry> = {};
  for (const batch of chunkWidgetQueries([...queries])) {
    const res = await request(batch);
    if (res.status !== 200) {
      throw apiContractError(res, "Widget aggregates request failed");
    }
    const results = (
      res.body as { results?: Record<string, WidgetAggregateResultEntry> } | null | undefined
    )?.results;
    if (results) Object.assign(merged, results);
  }
  return merged;
}
