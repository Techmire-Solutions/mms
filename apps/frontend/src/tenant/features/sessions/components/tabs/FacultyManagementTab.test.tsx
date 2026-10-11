import React, { act } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { FacultyManagementTab } from "./FacultyManagementTab";
import type { Session } from "@/lib/data/sessionsData";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/collections/faculty", () => ({
  useFacultyContractList: () => ({
    data: {
      body: {
        faculty: [
          { id: "faculty-1", name: "Ustadh Ali" },
          { id: "faculty-2", name: "Ustadh Hassan" },
        ],
      },
    },
  }),
  useFacultyByIds: () => ({
    data: [],
  }),
}));

const mockSession: Session = {
  id: "session-1",
  name: "Fall 2026",
  type: "Hifz",
  startDate: "2026-09-01",
  endDate: "2026-12-20",
  status: "active",
  currency: "USD",
  baseFee: 100,
  classes: [],
  faculty: [
    {
      id: "fac-1",
      sessionId: "session-1",
      facultyId: "faculty-1",
      facultyName: "Ustadh Ali",
      role: "Lead Instructor",
      status: "active",
    },
  ],
};

describe("FacultyManagementTab", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    return () => {
      if (container) {
        container.remove();
        container = null;
      }
    };
  });

  it("renders faculty cards when faculty exists", async () => {
    const root = createRoot(container!);

    await act(async () => {
      root.render(
        <FacultyManagementTab session={mockSession} onUpdate={vi.fn()} canMutate={true} />,
      );
    });

    expect(document.body.textContent).toContain("Ustadh Ali");
    expect(document.body.textContent).toContain("Lead Instructor");
    expect(document.body.textContent).toContain("active");
  });

  it("renders empty state when no faculty is assigned", async () => {
    const emptySession: Session = { ...mockSession, faculty: [] };
    const root = createRoot(container!);

    await act(async () => {
      root.render(
        <FacultyManagementTab session={emptySession} onUpdate={vi.fn()} canMutate={true} />,
      );
    });

    expect(document.body.textContent).toContain("sessions.faculty.emptyTitle");
  });

  it("triggers onUpdate with removed faculty when delete button is clicked", async () => {
    const onUpdate = vi.fn();
    const root = createRoot(container!);

    await act(async () => {
      root.render(
        <FacultyManagementTab session={mockSession} onUpdate={onUpdate} canMutate={true} />,
      );
    });

    const deleteBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete faculty"]',
    );
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn?.click();
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "session-1",
        faculty: [],
      }),
    );
  });
});
