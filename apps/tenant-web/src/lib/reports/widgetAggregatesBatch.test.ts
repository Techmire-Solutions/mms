import { describe, expect, it, vi } from "vitest";
import {
  chunkWidgetQueries,
  fetchWidgetAggregatesBatched,
} from "@mms/fe-core/lib/widgetAggregatesBatch";

describe("widgetAggregatesBatch", () => {
  it("splits into bounded batches of 32", () => {
    const queries = Array.from({ length: 33 }, (_, i) => ({ id: `w-${i}` }));
    const chunks = chunkWidgetQueries(queries);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(32);
    expect(chunks[1]).toHaveLength(1);
  });

  it("fans out across batches and merges results by id", async () => {
    const queries = Array.from({ length: 33 }, (_, i) => ({ id: `w-${i}` }));
    const request = vi.fn().mockImplementation(async (batch: Array<{ id: string }>) => ({
      status: 200,
      body: {
        results: Object.fromEntries(batch.map((q) => [q.id, { value: 1 }])),
      },
    }));

    const merged = await fetchWidgetAggregatesBatched(queries, request);

    expect(request).toHaveBeenCalledTimes(2);
    expect(Object.keys(merged)).toHaveLength(33);
    expect(merged["w-32"]).toEqual({ value: 1 });
  });

  it("rejects (does not silently empty) when a batch fails", async () => {
    const queries = Array.from({ length: 40 }, (_, i) => ({ id: `w-${i}` }));
    const request = vi.fn().mockResolvedValue({ status: 400, body: { type: "validation_error" } });

    await expect(fetchWidgetAggregatesBatched(queries, request)).rejects.toMatchObject({
      status: 400,
    });
  });
});
