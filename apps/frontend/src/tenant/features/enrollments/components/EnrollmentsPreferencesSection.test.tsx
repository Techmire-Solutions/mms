import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_ENROLLMENTS_SETTINGS } from "@mms/shared";
import { EnrollmentsPreferencesSection } from "./EnrollmentsPreferencesSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("EnrollmentsPreferencesSection", () => {
  it("renders the default view layout control and inline numeric errors", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsPreferencesSection
        settingsDraft={{ ...DEFAULT_ENROLLMENTS_SETTINGS }}
        upd={vi.fn()}
        errors={{
          maxStudentsPerClass: "enrollments.settings.invalidInteger",
          waitlistOfferHours: "enrollments.settings.invalidRange",
        }}
      />,
    );
    expect(html).toContain('name="defaultViewLayout"');
    expect(html).toContain('id="maxStudentsPerClass"');
    expect(html).toContain("enrollments.settings.invalidInteger");
    expect(html).toContain("enrollments.settings.invalidRange");
  });
});
