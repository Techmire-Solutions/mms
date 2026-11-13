import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkshopEvent } from "@mms/shared";
import { WorkshopPhaseBadge } from "./WorkshopPhaseBadge";
import { lifecycleActions } from "./WorkshopDetailDrawer";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en", dir: "ltr", isRtl: false }),
}));

const workshop = (fields: Partial<WorkshopEvent> = {}): WorkshopEvent => ({
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
  minAttendancePct: null,
  minScorePct: null,
  participantCount: 0,
  waitlistEnabled: false,
  status: "open",
  phase: "registration_open",
  ...fields,
});

const targets = (fields: Partial<WorkshopEvent>) =>
  lifecycleActions(workshop(fields)).map((action) => action.to);

describe("workshop lifecycle actions", () => {
  it("offers Publish for a draft", () => {
    expect(targets({ status: "draft", phase: "draft" })).toEqual(["open"]);
  });

  it("offers Complete only once the workshop finished, Unpublish only while empty, and Cancel", () => {
    expect(targets({ status: "open", phase: "finished" })).toEqual([
      "completed",
      "draft",
      "cancelled",
    ]);
    expect(targets({ status: "open", phase: "ongoing", participantCount: 3 })).toEqual([
      "cancelled",
    ]);
    expect(targets({ status: "open", phase: "registration_open" })).toEqual(["draft", "cancelled"]);
  });

  it("hides complete/cancel from a writer without workshops.manage", () => {
    expect(
      lifecycleActions(workshop({ status: "open", phase: "finished" }), false).map(
        (action) => action.to,
      ),
    ).toEqual(["draft"]);
    expect(
      lifecycleActions(workshop({ status: "open", phase: "registration_open" }), false).map(
        (action) => action.to,
      ),
    ).toEqual(["draft"]);
  });

  it("offers nothing on a terminal or archived workshop", () => {
    expect(targets({ status: "completed", phase: "completed" })).toEqual([]);
    expect(targets({ status: "cancelled", phase: "cancelled" })).toEqual([]);
  });

  it("marks Cancel destructive and reason-bearing", () => {
    const cancel = lifecycleActions(workshop()).find((action) => action.to === "cancelled");
    expect(cancel).toMatchObject({ destructive: true, reason: true });
  });
});

describe("WorkshopPhaseBadge", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the translated phase label for every phase", () => {
    const phases = [
      "draft",
      "registration_open",
      "registration_closed",
      "ongoing",
      "finished",
      "completed",
      "cancelled",
      "archived",
    ] as const;
    act(() => {
      root.render(
        <div>
          {phases.map((phase) => (
            <WorkshopPhaseBadge key={phase} phase={phase} />
          ))}
        </div>,
      );
    });
    for (const phase of phases) {
      expect(container.textContent).toContain(`workshops.phase.${phase}`);
    }
  });
});
