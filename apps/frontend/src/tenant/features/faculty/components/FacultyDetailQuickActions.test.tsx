import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Faculty } from "@mms/contracts";
import { FacultyDetailQuickActions } from "./FacultyDetailQuickActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.phone) return `${key}:${params.phone}`;
      return key;
    },
  }),
}));

const mockFaculty: Faculty = {
  id: "fac-qa-1",
  contactId: "cnt-1",
  name: "Ustadh Umar",
  status: "active",
  employeeId: "EMP-010",
  gender: "male",
  specialization: "Tajweed",
  phone: "+1 555-0100",
  email: "umar@example.com",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("FacultyDetailQuickActions Component", () => {
  it("renders quick action channels when messaging is enabled", () => {
    const html = renderToStaticMarkup(
      <FacultyDetailQuickActions
        faculty={mockFaculty}
        displayName="Ustadh Umar"
        primaryPhone="+1 555-0100"
        primaryEmail="umar@example.com"
        hasWhatsAppContact={true}
        canWriteMessaging={true}
        onOpenComposer={vi.fn()}
      />,
    );

    expect(html).toContain("faculty.detail.call");
    expect(html).toContain("faculty.list.actionWhatsApp");
    expect(html).toContain("faculty.list.actionSms");
    expect(html).toContain("faculty.list.actionEmail");
  });
});
