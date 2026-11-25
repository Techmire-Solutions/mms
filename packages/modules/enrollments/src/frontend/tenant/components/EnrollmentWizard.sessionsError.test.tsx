import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentWizard } from "./EnrollmentWizard";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../host/sessionsCollection", () => ({
  useSessions: () => ({
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: vi.fn(),
  }),
}));

vi.mock("../host/useEnrollmentConfig", () => ({
  useEnrollmentConfig: () => ({ fields: {}, customFields: [] }),
}));

describe("EnrollmentWizard sessions failure", () => {
  it("shows a retryable error instead of an empty session list", () => {
    const html = renderToStaticMarkup(<EnrollmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(html).toContain("enrollments.wizard.sessionsLoadFailed");
  });
});
