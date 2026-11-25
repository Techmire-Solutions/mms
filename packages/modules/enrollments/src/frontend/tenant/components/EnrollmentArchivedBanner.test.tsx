import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentArchivedBanner } from "./EnrollmentArchivedBanner";

const mockArchivedEnrollment = {
  id: "enr-1",
  deletedAt: "2024-01-01T00:00:00Z",
  deletionReason: "Student transferred to another school",
} as unknown as never;

describe("EnrollmentArchivedBanner Component", () => {
  it("renders archived banner with deletion reason", () => {
    const html = renderToStaticMarkup(
      <EnrollmentArchivedBanner enrollment={mockArchivedEnrollment} />,
    );

    expect(html).toContain("Student transferred to another school");
  });
});
