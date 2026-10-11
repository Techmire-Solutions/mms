import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionCard, type SessionCardProps } from "./SessionCard";
import type { Session } from "@/lib/data/sessionsData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params && "name" in params) return `${key}:${String(params.name)}`;
      return key;
    },
  }),
}));

vi.mock("./SessionListRowActions", () => ({
  SessionListRowActions: () => <div data-testid="session-row-actions">Actions</div>,
}));

const mockSession: Session = {
  id: "ses-1",
  name: "Spring Semester 2025",
  description: "Academic year 2025 morning session",
  status: "active",
  type: "academic",
  startDate: "2025-01-01",
  endDate: "2025-06-30",
  classes: [{ id: "c-1", name: "Hifz A", capacity: 20, enrolledCount: 15 }],
} as unknown as Session;

const baseProps: SessionCardProps = {
  session: mockSession,
  selectedIds: [],
  canSelectSessions: true,
  showDeleted: false,
  canDelete: true,
  isColumnVisible: () => true,
  columnRegistry: [
    { key: "status", label: "Status", enabled: true, order: 0 },
    { key: "type", label: "Type", enabled: true, order: 1 },
  ],
  statusConfig: { active: { label: "Active", cls: "bg-success" } },
  typeConfig: { academic: { label: "Academic", cls: "bg-primary" } },
  onView: vi.fn(),
  onToggleSelectedSession: vi.fn(),
  onRequestDelete: vi.fn(),
  onRestore: vi.fn(),
};

describe("SessionCard Component", () => {
  it("renders session name, description, and action button", () => {
    const html = renderToStaticMarkup(<SessionCard {...baseProps} />);
    expect(html).toContain("Spring Semester 2025");
    expect(html).toContain("Academic year 2025 morning session");
    expect(html).toContain("sessions.actionViewShort");
  });

  it("renders with accessible article role and tabindex", () => {
    const html = renderToStaticMarkup(<SessionCard {...baseProps} />);
    expect(html).toContain('role="article"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('data-selected="false"');
  });

  it("renders selected state when session is in selectedIds", () => {
    const html = renderToStaticMarkup(<SessionCard {...baseProps} selectedIds={["ses-1"]} />);
    expect(html).toContain('data-selected="true"');
    expect(html).toContain("border-primary/50");
  });

  it("renders row actions when canDelete is true", () => {
    const html = renderToStaticMarkup(<SessionCard {...baseProps} canDelete={true} />);
    expect(html).toContain("session-row-actions");
  });

  it("hides row actions when canDelete is false", () => {
    const html = renderToStaticMarkup(<SessionCard {...baseProps} canDelete={false} />);
    expect(html).not.toContain("session-row-actions");
  });
});
