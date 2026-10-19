import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionSchema, type SessionCompletionRow } from "@mms/shared";
import { SessionCompletionTab } from "./SessionCompletionTab";

const rows: SessionCompletionRow[] = [
  {
    enrollmentId: "e1",
    studentId: "s1",
    studentName: "Ali",
    className: "Batch A",
    attendancePct: 92.5,
    examsPassed: true,
    status: "completed",
    shortfalls: [],
    completedAt: "2026-03-31T10:00:00Z",
    certificateIssuedAt: null,
  },
  {
    enrollmentId: "e2",
    studentId: "s2",
    studentName: "Bilal",
    className: "Batch A",
    attendancePct: 50,
    examsPassed: false,
    status: "not_completed",
    shortfalls: ["attendance_below", "exam_not_passed"],
    completedAt: null,
    certificateIssuedAt: null,
  },
];

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));
vi.mock("@/lib/contexts/BrandingPaletteContext", () => ({
  useBrandPalette: () => ({ primary: "hsl(var(--primary))", secondary: "" }),
}));
vi.mock("@/tenant/features/sessions/hooks/useSessionCompletion", () => ({
  useSessionCompletion: () => ({ data: rows, isLoading: false, isError: false }),
  useSessionCompletionActions: () => ({
    evaluate: vi.fn(),
    issueCertificates: vi.fn(),
    isPending: false,
  }),
}));

const session = SessionSchema.parse({
  id: "course",
  name: "Tajweed",
  minAttendancePct: 75,
  requiresExamPass: true,
});

describe("SessionCompletionTab", () => {
  it("given evaluated rows, should show each standing with its shortfalls", () => {
    // Act
    const html = renderToStaticMarkup(<SessionCompletionTab session={session} canWrite />);

    // Assert
    expect(html).toContain("sessions.completion.criteriaSummary:75%,common.yes");
    expect(html).toContain("92.5%");
    expect(html).toContain("sessions.completion.shortfall.attendanceBelow");
    expect(html).toContain("sessions.completion.shortfall.examNotPassed");
  });

  it("given a writer, should offer evaluation and certificates for completed students only", () => {
    // Act
    const html = renderToStaticMarkup(<SessionCompletionTab session={session} canWrite />);

    // Assert
    expect(html).toContain("sessions.completion.evaluate");
    expect(html).toContain("sessions.completion.issueAll:1");
  });

  it("given a reader, should hide the evaluation actions", () => {
    // Act
    const html = renderToStaticMarkup(<SessionCompletionTab session={session} canWrite={false} />);

    // Assert
    expect(html).not.toContain("sessions.completion.evaluate");
  });
});
