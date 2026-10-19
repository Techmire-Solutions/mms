import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionSchema } from "@mms/shared";
import { SessionLifecycleBar } from "./SessionLifecycleBar";
import { SessionActivityTab } from "./tabs/SessionActivityTab";

const activity = vi.hoisted(() => ({
  data: [] as {
    on: string;
    kind: string;
    title: string;
    detail: string | null;
    actor: string | null;
  }[],
}));

vi.mock("@/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/tenant/hooks/collections/enrollments", () => ({
  useEnrollmentsCollection: () => [{ studentId: "s1" }],
}));
vi.mock("@/tenant/components/messaging/NotifyGuardiansButton", () => ({
  NotifyGuardiansButton: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock("@/components/app/FormModal", () => ({ FormModal: () => null }));
vi.mock("@/tenant/features/sessions/hooks/useSessionLifecycleOps", () => ({
  useSessionLifecycleActions: () => ({ cancel: vi.fn(), postpone: vi.fn(), isPending: false }),
  useSessionActivity: () => ({ data: activity.data, isError: false, isLoading: false }),
}));

vi.mock("@/tenant/features/sessions/hooks/useSessionRollover", () => ({
  useSessionRolloverRuns: () => ({ data: [{ status: "running" }] }),
}));
vi.mock("./SessionRolloverModal", () => ({ SessionRolloverModal: () => null }));

const session = (status: string) => SessionSchema.parse({ id: "s", name: "Hifz", status });

describe("SessionLifecycleBar", () => {
  it("given an open session, should offer postpone and cancel", () => {
    // Act
    const html = renderToStaticMarkup(<SessionLifecycleBar session={session("open")} />);

    // Assert
    expect(html).toContain("sessions.lifecycleOps.postpone");
    expect(html).toContain("sessions.lifecycleOps.cancel");
  });

  it("given a started session, should offer cancel but not postpone", () => {
    // Act
    const html = renderToStaticMarkup(<SessionLifecycleBar session={session("in_progress")} />);

    // Assert
    expect(html).not.toContain("sessions.lifecycleOps.postpone");
    expect(html).toContain("sessions.lifecycleOps.cancel");
  });

  it("given a session with a running rollover, should offer rollover and show the run status", () => {
    // Act
    const html = renderToStaticMarkup(<SessionLifecycleBar session={session("completed")} />);

    // Assert
    expect(html).toContain("sessions.rollover.action");
    expect(html).toContain("sessions.rollover.run.running");
  });

  it("given a cancelled session, should offer only the guardian notice", () => {
    // Act
    const html = renderToStaticMarkup(<SessionLifecycleBar session={session("cancelled")} />);

    // Assert
    expect(html).toContain("sessions.lifecycleOps.notifyGuardians");
    expect(html).not.toContain("sessions.lifecycleOps.cancel<");
  });
});

describe("SessionActivityTab", () => {
  it("given activity, should label known kinds and fall back to the raw kind", () => {
    // Arrange
    activity.data = [
      {
        on: "2026-03-01",
        kind: "transferred",
        title: "Ali",
        detail: "Evening batch",
        actor: "Admin",
      },
      { on: "2026-02-01", kind: "something_new", title: "X", detail: null, actor: null },
    ];

    // Act
    const html = renderToStaticMarkup(<SessionActivityTab session={session("in_progress")} />);

    // Assert
    expect(html).toContain("sessions.activity.kind.transferred");
    expect(html).toContain("Evening batch");
    expect(html).toContain("something_new");
  });

  it("given no activity, should show the empty state", () => {
    // Arrange
    activity.data = [];

    // Act
    const html = renderToStaticMarkup(<SessionActivityTab session={session("open")} />);

    // Assert
    expect(html).toContain("sessions.activity.empty");
  });
});
