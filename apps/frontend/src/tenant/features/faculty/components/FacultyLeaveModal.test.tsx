import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FacultyMember } from "@mms/shared";
import { FacultyLeaveModal } from "./FacultyLeaveModal";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    dir: "ltr",
  }),
}));

vi.mock("@/tenant/features/faculty/hooks/useFacultyTsrQueries", () => ({
  useFacultyContractList: () => ({
    data: {
      status: 200,
      body: {
        faculty: [
          { id: "fac-sub-1", name: "Ustadh Badl", designation: "Quran Teacher", status: "active" },
        ],
        total: 1,
      },
    },
  }),
}));

vi.mock("@/components/app/Modal", () => ({
  Modal: ({
    open,
    title,
    subtitle,
    children,
  }: {
    open?: boolean;
    title: React.ReactNode;
    subtitle: React.ReactNode;
    children: React.ReactNode;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="leave-modal">
        <h2>{title}</h2>
        <h3>{subtitle}</h3>
        <div>{children}</div>
      </div>
    );
  },
}));

const mockFaculty: FacultyMember = {
  id: "fac-1",
  contactId: "cnt-1",
  name: "Sheikh Tariq",
  status: "active",
  leaveDetails: {
    isOnLeave: true,
    category: "hajj_umrah",
    startDate: "2026-06-01",
    endDate: "2026-06-25",
    substituteFacultyId: "fac-sub-1",
    substituteFacultyName: "Ustadh Badl",
    reason: "Performing mandatory pilgrimage",
  },
};

describe("FacultyLeaveModal", () => {
  it("renders leave modal with leave status, category, and dates when open", () => {
    const html = renderToStaticMarkup(
      <FacultyLeaveModal
        open={true}
        onClose={vi.fn()}
        faculty={mockFaculty}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("faculty.leave.title");
    expect(html).toContain("Sheikh Tariq");
    expect(html).toContain("faculty.leave.status");
    expect(html).toContain("faculty.leave.onLeave");
    expect(html).toContain("faculty.leave.category");
    expect(html).toContain("Performing mandatory pilgrimage");
    expect(html).toContain("Ustadh Badl (Quran Teacher)");
  });

  it("renders null when open is false", () => {
    const html = renderToStaticMarkup(
      <FacultyLeaveModal
        open={false}
        onClose={vi.fn()}
        faculty={mockFaculty}
        onSave={vi.fn()}
      />,
    );

    expect(html).toBe("");
  });
});
