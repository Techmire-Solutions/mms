import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  calculateRemainingRetentionDays,
  RetentionCountdownBadge,
  DetailDrawerArchivedBanner,
  EntityArchivedBanner,
} from "./DetailDrawerArchiveChrome";

describe("DetailDrawerArchiveChrome retention utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("calculateRemainingRetentionDays", () => {
    it("returns null when retentionDays is null or undefined", () => {
      expect(calculateRemainingRetentionDays("2026-02-01T12:00:00Z", null)).toBeNull();
      expect(calculateRemainingRetentionDays("2026-02-01T12:00:00Z", undefined)).toBeNull();
    });

    it("returns null when deletedAt is invalid or missing", () => {
      expect(calculateRemainingRetentionDays(null, 30)).toBeNull();
      expect(calculateRemainingRetentionDays("invalid-date", 30)).toBeNull();
    });

    it("calculates remaining days accurately", () => {
      // Deleted on Feb 25, 2026. Retention = 10 days. Purge = Mar 7, 2026.
      // Now = Mar 1, 2026. Difference = 6 days.
      const remaining = calculateRemainingRetentionDays("2026-02-25T12:00:00Z", 10);
      expect(remaining).toBe(6);
    });

    it("returns 0 if purge date has passed", () => {
      // Deleted on Jan 1, 2026. Retention = 10 days. Purge = Jan 11, 2026.
      // Now = Mar 1, 2026.
      const remaining = calculateRemainingRetentionDays("2026-01-01T12:00:00Z", 10);
      expect(remaining).toBe(0);
    });
  });

  describe("RetentionCountdownBadge", () => {
    it("renders 'Archived indefinitely' when retentionDays is null", () => {
      const html = renderToStaticMarkup(
        <RetentionCountdownBadge deletedAt="2026-02-01T12:00:00Z" retentionDays={null} />,
      );
      expect(html).toContain("common.archivedIndefinitely");
    });

    it("renders warning tone with emoji when <= 7 days remain", () => {
      // Deleted 5 days ago (Feb 24), retention = 8 days -> 3 days remaining
      const html = renderToStaticMarkup(
        <RetentionCountdownBadge deletedAt="2026-02-24T12:00:00Z" retentionDays={8} />,
      );
      expect(html).toContain("⚠️ common.purgesInDays");
      expect(html).toContain("text-destructive");
    });

    it("renders standard tone when > 7 days remain", () => {
      // Deleted 1 day ago (Feb 28), retention = 30 days -> 29 days remaining
      const html = renderToStaticMarkup(
        <RetentionCountdownBadge deletedAt="2026-02-28T12:00:00Z" retentionDays={30} />,
      );
      expect(html).toContain("common.purgesInDays");
      expect(html).not.toContain("⚠️");
    });
  });

  describe("DetailDrawerArchivedBanner", () => {
    it("appends retention note when retentionDays is configured", () => {
      const html = renderToStaticMarkup(
        <DetailDrawerArchivedBanner
          deletedAt="2026-02-24T12:00:00Z"
          title="Archived Record"
          retentionDays={8}
        />,
      );
      expect(html).toContain("Archived Record");
      expect(html).toContain("⚠️ common.purgesInDays");
    });

    it("appends 'Archived indefinitely' when retentionDays is null", () => {
      const html = renderToStaticMarkup(
        <DetailDrawerArchivedBanner
          deletedAt="2026-02-24T12:00:00Z"
          title="Archived Record"
          retentionDays={null}
        />,
      );
      expect(html).toContain("Archived Record");
      expect(html).toContain("common.archivedIndefinitely");
    });
  });

  describe("EntityArchivedBanner", () => {
    it("passes retentionDays through to banner", () => {
      const html = renderToStaticMarkup(
        <EntityArchivedBanner
          deletedAt="2026-02-28T12:00:00Z"
          deletionReason="Duplicate record"
          titleWithDate={(d) => `Archived on ${d}`}
          reasonLabel="Reason"
          retentionDays={30}
        />,
      );
      expect(html).toContain("Duplicate record");
      expect(html).toContain("common.purgesInDays");
    });
  });
});
