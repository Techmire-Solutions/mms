import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { parseMessagingWorkFilters } from "./useMessagingWorkFilters";
import { useMessagingWorkTierUrlSync } from "./useMessagingWorkTierUrlSync";

describe("parseMessagingWorkFilters", () => {
  it("keeps valid enum and date values", () => {
    const parsed = parseMessagingWorkFilters(
      new URLSearchParams(
        "channel=sms&status=delivered&category=all&search=ali&startDate=2026-10-01&endDate=2026-10-31",
      ),
    );
    expect(parsed).toEqual({
      channel: "sms",
      status: "delivered",
      category: "all",
      search: "ali",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    });
  });

  it("falls back for unknown enum values and impossible dates", () => {
    const parsed = parseMessagingWorkFilters(
      new URLSearchParams("channel=bogus&status=weird&startDate=2026-02-31&endDate=banana"),
    );
    expect(parsed.channel).toBe("all");
    expect(parsed.status).toBe("all");
    expect(parsed.startDate).toBe("");
    expect(parsed.endDate).toBe("");
  });
});

describe("useMessagingWorkTierUrlSync", () => {
  it("writes the date range to the URL", async () => {
    const searchParams = new URLSearchParams();
    const setSearchParams = vi.fn();

    function Host() {
      useMessagingWorkTierUrlSync({
        searchParams,
        setSearchParams: setSearchParams as never,
        channel: "all",
        status: "all",
        category: "all",
        debouncedSearch: "",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      });
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Host />);
    });

    expect(setSearchParams).toHaveBeenCalled();
    const next = setSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;
    expect(next.get("startDate")).toBe("2026-10-01");
    expect(next.get("endDate")).toBe("2026-10-31");

    await act(async () => root.unmount());
  });
});
