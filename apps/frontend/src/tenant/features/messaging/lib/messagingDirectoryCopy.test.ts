import { describe, expect, it } from "vitest";
import { resolveMessagingDirectoryCopy } from "./messagingDirectoryCopy";

describe("resolveMessagingDirectoryCopy", () => {
  it("uses archived copy and hides the campaign CTA in the archived view", () => {
    const copy = resolveMessagingDirectoryCopy({ showArchived: true, hasActiveFilters: false });

    expect(copy.titleKey).toBe("messaging.archivedEmpty");
    expect(copy.descriptionKey).toBe("messaging.archivedEmptyDesc");
    expect(copy.showFirstRunAction).toBe(false);
  });

  it("prefers the filter copy when the archived view is filtered", () => {
    const copy = resolveMessagingDirectoryCopy({ showArchived: true, hasActiveFilters: true });

    expect(copy.titleKey).toBe("messaging.noLogsMatchFilters");
    expect(copy.showFirstRunAction).toBe(false);
  });

  it("offers the campaign CTA only for a truly empty active directory", () => {
    const copy = resolveMessagingDirectoryCopy({ showArchived: false, hasActiveFilters: false });

    expect(copy.titleKey).toBe("messaging.noLogs");
    expect(copy.descriptionKey).toBe("messaging.selectRecipientsDesc");
    expect(copy.showFirstRunAction).toBe(true);
  });
});
