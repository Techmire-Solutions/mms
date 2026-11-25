import { describe, expect, it } from "vitest";
import {
  messagingCommandMetricsQueryOptions,
  messagingLogsListQueryOptions,
} from "./useMessagingQueries";

describe("messagingCommandMetricsQueryOptions", () => {
  it("uses the bare metrics key without date bounds", () => {
    const options = messagingCommandMetricsQueryOptions();
    expect(options.queryKey).toEqual(["messaging", "metrics"]);
  });

  it("bounds the metrics query by both startDate and endDate", () => {
    const options = messagingCommandMetricsQueryOptions({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    expect(options.queryKey).toEqual(["messaging", "metrics", "2026-01-01", "2026-01-31"]);
  });

  it("trims blank date bounds out of the key", () => {
    const options = messagingCommandMetricsQueryOptions({
      startDate: "  ",
      endDate: "2026-01-31",
    });
    expect(options.queryKey).toEqual(["messaging", "metrics", undefined, "2026-01-31"]);
  });
});

describe("messagingLogsListQueryOptions", () => {
  it("keeps the previous page visible while the next page loads", () => {
    const options = messagingLogsListQueryOptions({ page: 1, limit: 25 });
    expect(typeof options.placeholderData).toBe("function");
  });
});
