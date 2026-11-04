import { describe, expect, it } from "vitest";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { formatShownMessagesLabel } from "./messagingCounts";

const t = ((key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${JSON.stringify(params)}` : key) as TranslationFunction;

describe("formatShownMessagesLabel", () => {
  it("shows the page count against the total match count", () => {
    expect(formatShownMessagesLabel(50, 1240, t)).toBe(
      'messaging.shownCount:{"count":50,"total":1240}',
    );
  });

  it("never reports a total smaller than the visible page", () => {
    // `total` can lag while a filtered page is still resolving.
    expect(formatShownMessagesLabel(25, 10, t)).toBe(
      'messaging.shownCount:{"count":25,"total":25}',
    );
  });
});
