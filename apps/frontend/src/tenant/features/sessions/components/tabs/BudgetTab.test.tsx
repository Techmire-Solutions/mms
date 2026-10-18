import React, { act } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { BudgetTab } from "./BudgetTab";
import type { Session } from "@/lib/data/sessionsData";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useFinanceCurrency: () => ({
    activeCurrency: { symbol: "$" },
  }),
}));

const mockSession: Session = {
  id: "session-1",
  name: "Spring 2026",
  type: "Hifz",
  startDate: "2026-01-10",
  endDate: "2026-05-30",
  status: "active",
  currency: "USD",
  baseFee: 100,
  faculty: [],
  classes: [
    {
      id: "class-1",
      name: "Fiqh Level 1",
      room: "Room A",
      gender: "mixed",
      minAge: 6,
      maxAge: 12,
      maxStudents: 25,
      enrolled: 15,
      ageCalculationDate: "2026-01-01",
      enrollmentDeadline: "2026-02-01",
      status: "active",
      facultyId: "t-1",
      facultyName: "Sheikh Ahmad",
      fees: [],
      schedules: [],
      discounts: [],
      timetables: [],
      refreshments: [],
      scholarships: [],
      budgets: [
        {
          id: "b-1",
          classId: "class-1",
          budgetType: "income",
          detail: "Book Sales",
          amount: 500,
        },
        {
          id: "b-2",
          classId: "class-1",
          budgetType: "expense",
          detail: "Stationery",
          amount: 150,
        },
      ],
    },
  ],
};

describe("BudgetTab", () => {
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

  it("renders budget overview totals, income items, and expense items", async () => {
    const root = createRoot(container!);

    await act(async () => {
      root.render(<BudgetTab session={mockSession} onUpdate={vi.fn()} canMutate={true} />);
    });

    // Overview cards
    expect(document.body.textContent).toContain("sessions.budget.totalIncome");
    expect(document.body.textContent).toContain("sessions.budget.totalExpenses");
    expect(document.body.textContent).toContain("sessions.budget.netBalance");

    // Items
    expect(document.body.textContent).toContain("Book Sales");
    expect(document.body.textContent).toContain("Stationery");
    expect(document.body.textContent).toContain("Class: Fiqh Level 1");
  });

  it("opens delete confirmation and triggers onUpdate when confirmed", async () => {
    const onUpdate = vi.fn();
    const root = createRoot(container!);

    await act(async () => {
      root.render(<BudgetTab session={mockSession} onUpdate={onUpdate} canMutate={true} />);
    });

    const deleteBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete Book Sales"]',
    );
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn?.click();
    });

    expect(document.body.textContent).toContain("sessions.budget.confirmDeleteTitle");

    const confirmBtn = Array.from(document.body.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("common.delete"),
    );
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn?.click();
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        classes: [
          expect.objectContaining({
            id: "class-1",
            budgets: [
              expect.objectContaining({
                id: "b-2",
                detail: "Stationery",
              }),
            ],
          }),
        ],
      }),
    );
  });
});
