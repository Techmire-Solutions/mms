import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkshopDetail } from "@mms/shared";
import { WorkshopCheckInSection } from "./WorkshopCheckInSection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mutateAsync = vi.fn();

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en", dir: "ltr", isRtl: false }),
}));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../hooks/useWorkshopsApi", () => ({
  useSaveWorkshopAttendance: () => ({ mutateAsync, isPending: false }),
}));

const participant = (id: string, name: string) => ({
  id,
  workshopId: "w1",
  contactId: `c-${id}`,
  contactName: name,
  contactPhone: "",
  status: "registered" as const,
});

const detail = (fields: Partial<WorkshopDetail["workshop"]> = {}): WorkshopDetail => ({
  workshop: {
    id: "w1",
    title: "Calligraphy",
    description: "",
    startDate: "2099-03-01",
    endDate: "2099-03-02",
    registrationDeadline: null,
    capacity: null,
    fee: null,
    programId: null,
    subjectId: null,
    participantCount: 2,
    ...fields,
  },
  participants: [participant("p1", "Amina"), participant("p2", "Bilal")],
  attendance: [{ participantId: "p1", dayOn: "2099-03-01", status: "present" }],
  scores: [],
});

describe("WorkshopCheckInSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mutateAsync.mockReset().mockResolvedValue({ attendance: [] });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("given a workshop without dates, should explain that check-in needs dates", async () => {
    await act(async () => {
      root.render(
        <WorkshopCheckInSection detail={detail({ startDate: null, endDate: null })} canWrite />,
      );
    });
    expect(container.textContent).toContain("workshops.checkInNeedsDates");
  });

  it("given stored marks for the first day, should save them for that day", async () => {
    // Arrange
    await act(async () => {
      root.render(<WorkshopCheckInSection detail={detail()} canWrite />);
    });
    const saveButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("workshops.saveCheckIn"),
    );

    // Act
    await act(async () => saveButton?.click());

    // Assert
    expect(mutateAsync).toHaveBeenCalledWith({
      id: "w1",
      body: { dayOn: "2099-03-01", marks: [{ participantId: "p1", status: "present" }] },
    });
  });

  it("given read-only access, should not offer saving", async () => {
    await act(async () => {
      root.render(<WorkshopCheckInSection detail={detail()} canWrite={false} />);
    });
    expect(container.textContent).not.toContain("workshops.saveCheckIn");
  });
});
