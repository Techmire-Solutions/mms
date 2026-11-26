import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AuditLog } from "./AuditLog";

vi.mock("../host/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    session: { singular: "Session", plural: "Sessions" },
    class: { singular: "Class", plural: "Classes" },
    section: { singular: "Section", plural: "Sections" },
  }),
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

vi.mock("../host/sessionsCollection", () => ({
  useSessionsCollection: () => [],
}));

vi.mock("../host/studentsCollection", () => ({
  useStudentsByIds: () => ({ data: [] }),
}));

vi.mock("./MarkAttendance", () => ({
  getAuditLog: () => [
    {
      ts: "2025-01-01T10:00:00Z",
      action: "submitted",
      count: 20,
      by: "admin",
    },
  ],
}));

describe("AuditLog Component", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      const currentRoot = root;
      root = null;
      await act(async () => {
        currentRoot.unmount();
      });
    }
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("renders audit log entries list after loading", async () => {
    await act(async () => {
      root!.render(
        React.createElement(AuditLog, { filters: { classId: "cls-1", date: "2025-01-01" } }),
      );
    });

    expect(container!.innerHTML).toContain("attendance.audit.title");
    expect(container!.innerHTML).toContain("attendance.audit.action.submitted");
    expect(container!.innerHTML).toContain("admin");
  });

  it("renders audit log in cards mode without table", async () => {
    await act(async () => {
      root!.render(
        React.createElement(AuditLog, {
          filters: { classId: "cls-1", date: "2025-01-01" },
          viewMode: "cards",
        }),
      );
    });

    expect(container!.innerHTML).toContain("admin");
    expect(container!.innerHTML).not.toContain("<table");
  });

  it("renders audit log in table mode", async () => {
    await act(async () => {
      root!.render(
        React.createElement(AuditLog, {
          filters: { classId: "cls-1", date: "2025-01-01" },
          viewMode: "table",
        }),
      );
    });

    expect(container!.innerHTML).toContain("admin");
    expect(container!.innerHTML).toContain("<table");
  });
});
