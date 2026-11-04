import { describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";
import { runBatchMerge, type BatchMergePair } from "./duplicateBatchMerge";

const contact = (id: string): Contact => ({ id, name: `Contact ${id}` }) as Contact;

const pair = (id: string, keep: string, other: string): BatchMergePair => ({
  id,
  contacts: [contact(keep), contact(other)],
});

describe("runBatchMerge", () => {
  it("keeps merging after one pair fails, reports counts, and forwards the error", async () => {
    const pairs = [pair("p1", "a", "b"), pair("p2", "c", "d"), pair("p3", "e", "f")];
    const failure = new Error("409 stale version");
    const onMerge = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const onPairError = vi.fn();

    const result = await runBatchMerge(pairs, {}, onMerge, onPairError);

    expect(result).toEqual({ merged: 2, failed: 1, mergedPairIds: ["p1", "p3"] });
    expect(onMerge).toHaveBeenCalledTimes(3);
    expect(onPairError).toHaveBeenCalledWith(failure, pairs[1]);
  });

  it("merges a contact that appears in two pairs only once", async () => {
    const pairs = [pair("p1", "a", "b"), pair("p2", "a", "c")];
    const onMerge = vi.fn().mockResolvedValue(undefined);

    const result = await runBatchMerge(pairs, {}, onMerge);

    expect(result).toEqual({ merged: 1, failed: 1, mergedPairIds: ["p1"] });
    expect(onMerge).toHaveBeenCalledTimes(1);
    // The first pair's keep/other pair is forwarded to the caller.
    expect(onMerge.mock.calls[0]?.[0]).toMatchObject({ id: "a" });
    expect(onMerge.mock.calls[0]?.[1]).toMatchObject({ id: "b" });
  });

  it("honours the per-pair keep selection", async () => {
    const pairs = [pair("p1", "a", "b")];
    const onMerge = vi.fn().mockResolvedValue(undefined);

    await runBatchMerge(pairs, { p1: 1 }, onMerge);

    expect(onMerge.mock.calls[0]?.[0]).toMatchObject({ id: "b" });
    expect(onMerge.mock.calls[0]?.[1]).toMatchObject({ id: "a" });
  });
});
