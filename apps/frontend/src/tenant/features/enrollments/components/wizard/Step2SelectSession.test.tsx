import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Step2SelectSession } from "./Step2SelectSession";
import type { Session } from "@/lib/data/sessionsData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count) return `${params.count} spots left`;
      return key;
    },
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useFinanceCurrency: () => ({
    formatCurrency: (val: number) => `$${val}`,
  }),
}));

const mockSessions: Session[] = [
  {
    id: "ses-1",
    name: "Spring 2025",
    type: "Hifz",
    status: "active",
    startDate: "2025-01-01T00:00:00Z",
    endDate: "2025-06-30T00:00:00Z",
    baseFee: 200,
    classes: [
      {
        id: "cls-1",
        name: "Hifz 1",
        capacity: 20,
        enrolled: 5,
        ageMin: 7,
        ageMax: 15,
        gender: "male",
        facultyId: "fac-1",
        facultyName: "Ustadh Ahmad",
      },
    ],
  } as unknown as Session,
];

describe("Step2SelectSession Component", () => {
  it("renders session card with spots and fee", () => {
    const html = renderToStaticMarkup(
      <Step2SelectSession value={null} onChange={vi.fn()} sessions={mockSessions} />,
    );

    expect(html).toContain("Spring 2025");
    expect(html).toContain("15 spots left");
    expect(html).toContain("$200");
  });
});
