import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionSchema } from "@mms/shared";
import { SessionRolloverModal } from "./SessionRolloverModal";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));
vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({ children, saveLabel }: { children: React.ReactNode; saveLabel: string }) => (
    <div>
      {children}
      <span>{saveLabel}</span>
    </div>
  ),
}));
vi.mock("@/tenant/features/sessions/hooks/useSessionRollover", () => ({
  useSessionRolloverActions: () => ({ preview: vi.fn(), start: vi.fn(), isPending: false }),
}));

const session = SessionSchema.parse({
  id: "s",
  name: "2026",
  status: "completed",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  classes: [
    { id: "c1", name: "Hifz 1", programId: "hifz" },
    { id: "c2", name: "Hifz 2", programId: "hifz" },
  ],
});

describe("SessionRolloverModal", () => {
  it("given a promotable session, should open on promote with the class map", () => {
    // Act
    const html = renderToStaticMarkup(
      <SessionRolloverModal session={session} open canPromote onClose={vi.fn()} />,
    );

    // Assert
    expect(html).toContain("sessions.rollover.startPromote");
    expect(html).toContain("sessions.rollover.nextClassFor:Hifz 1");
    expect(html).toContain("sessions.rollover.preview");
  });

  it("given a session that cannot be promoted, should only duplicate the structure", () => {
    // Act
    const html = renderToStaticMarkup(
      <SessionRolloverModal session={session} open canPromote={false} onClose={vi.fn()} />,
    );

    // Assert
    expect(html).toContain("sessions.rollover.startDuplicate");
    expect(html).not.toContain("sessions.rollover.classMap");
    expect(html).not.toContain("sessions.rollover.mode.promote");
  });

  it("given a session with an end date, should default the new dates to the following year", () => {
    // Act
    const html = renderToStaticMarkup(
      <SessionRolloverModal session={session} open canPromote onClose={vi.fn()} />,
    );

    // Assert
    expect(html).toContain("2027-01-01");
    expect(html).toContain("2027-12-31");
  });
});
