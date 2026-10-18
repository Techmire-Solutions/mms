import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionSchema } from "@mms/shared";
import { SessionClassSectionSelect, sessionIdForClass } from "./SessionClassSectionSelect";

vi.mock("@/hooks/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    session: { singular: "Session", plural: "Sessions" },
    class: { singular: "Class", plural: "Classes" },
    section: { singular: "Section", plural: "Sections" },
  }),
}));

const sessions = [
  SessionSchema.parse({ id: "s1", name: "Hifz 2026", classes: [{ id: "c1", name: "Darja 1" }] }),
];

describe("SessionClassSectionSelect", () => {
  it("given a class id, should resolve the owning session (empty for unknown ids)", () => {
    // Assert
    expect(sessionIdForClass(sessions, "c1")).toBe("s1");
    expect(sessionIdForClass(sessions, "missing")).toBe("");
    expect(sessionIdForClass(sessions, null)).toBe("");
  });

  it("given the levels prop, should render only the requested cascade depth", () => {
    // Arrange
    const value = { sessionId: "s1", classId: "c1", sectionId: "" };

    // Act
    const sessionOnly = renderToStaticMarkup(
      <SessionClassSectionSelect
        sessions={sessions}
        value={value}
        onChange={vi.fn()}
        levels="session"
        idPrefix="t"
      />,
    );
    const withSection = renderToStaticMarkup(
      <SessionClassSectionSelect
        sessions={sessions}
        value={value}
        onChange={vi.fn()}
        levels="section"
        idPrefix="t"
      />,
    );

    // Assert
    expect(sessionOnly).toContain('id="t-session"');
    expect(sessionOnly).not.toContain('id="t-class"');
    expect(withSection).toContain('id="t-class"');
    expect(withSection).toContain('id="t-section"');
  });
});
