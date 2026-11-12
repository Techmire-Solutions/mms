import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkshopDetail } from "@mms/shared";
import { WorkshopParticipantsSection } from "./WorkshopParticipantsSection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const addMutateAsync = vi.fn();
const removeMutate = vi.fn();
const notifySuccess = vi.fn();
const notifyError = vi.fn();

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en", dir: "ltr", isRtl: false }),
}));
vi.mock("@/lib/notify", () => ({
  notify: {
    success: (...args: unknown[]) => notifySuccess(...args),
    error: (...args: unknown[]) => notifyError(...args),
  },
}));
vi.mock("../hooks/useWorkshopsApi", () => ({
  useAddWorkshopParticipant: () => ({ mutateAsync: addMutateAsync, isPending: false }),
  useRemoveWorkshopParticipant: () => ({ mutate: removeMutate, isPending: false }),
}));
vi.mock("@/components/contactLink/ContactPicker", () => ({
  default: () => <div data-testid="contact-picker" />,
}));

const participant = (id: string, contactId: string, waitlistedAt: string | null) => ({
  id,
  workshopId: "w1",
  contactId,
  contactName: `Contact ${contactId}`,
  contactPhone: "",
  status: "registered" as const,
  completedAt: null,
  certificateIssuedAt: null,
  waitlistedAt,
});

const detail = (overrides: Partial<WorkshopDetail> = {}): WorkshopDetail => ({
  workshop: {
    id: "w1",
    title: "Calligraphy",
    description: "",
    startDate: "2099-03-01",
    endDate: "2099-03-02",
    registrationDeadline: null,
    capacity: 1,
    waitlistEnabled: true,
    fee: null,
    programId: null,
    subjectId: null,
    minAttendancePct: null,
    minScorePct: null,
    participantCount: 1,
    status: "open",
    phase: "registration_open",
  },
  participants: [participant("p1", "c1", null)],
  waitlisted: [participant("p2", "c2", "2099-01-01T00:00:00.000Z")],
  waitlistCount: 1,
  attendance: [],
  scores: [],
  ...overrides,
});

describe("WorkshopParticipantsSection waitlist", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    addMutateAsync.mockReset().mockResolvedValue({ participant: participant("p3", "c3", "x") });
    removeMutate.mockReset();
    notifySuccess.mockReset();
    notifyError.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (value: WorkshopDetail) =>
    act(async () => {
      root.render(<WorkshopParticipantsSection detail={value} canWrite canDelete />);
    });

  it("shows the waitlist with positions and offers to join it when full", async () => {
    await render(detail());
    expect(container.textContent).toContain("workshops.waitlist.heading");
    expect(container.textContent).toContain("workshops.waitlist.position");
    expect(container.textContent).toContain("workshops.waitlist.join");
    expect(container.textContent).not.toContain("workshops.full");
  });

  it("shows the derived registration state for the seated roster", async () => {
    await render(detail());
    expect(container.textContent).toContain("workshops.registrationState.registered");

    await render(
      detail({
        workshop: {
          ...detail().workshop,
          status: "completed",
          phase: "completed",
          participantCount: 1,
        },
        participants: [{ ...participant("p1", "c1", null), status: "completed" as const }],
        waitlisted: [],
        waitlistCount: 0,
      }),
    );
    expect(container.textContent).toContain("workshops.registrationState.completed");
  });

  it("keeps the plain full message when the waitlist is disabled", async () => {
    await render(
      detail({
        workshop: { ...detail().workshop, waitlistEnabled: false },
        waitlisted: [],
        waitlistCount: 0,
      }),
    );
    expect(container.textContent).toContain("workshops.full");
    expect(container.textContent).not.toContain("workshops.waitlist.join");
  });

  it("announces the promoted participant after a withdrawal", async () => {
    removeMutate.mockImplementation((_vars, callbacks) => {
      callbacks.onSuccess({ success: true, promoted: participant("p2", "c2", null) });
    });
    await render(detail());
    const button = Array.from(container.querySelectorAll("button")).find((element) =>
      element.getAttribute("aria-label")?.includes("workshops.withdrawNamed"),
    );
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(removeMutate).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith("workshops.waitlist.promoted");
  });
});
