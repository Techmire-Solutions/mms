import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type FacultyMember } from "@mms/shared";
import { ClassDetailGeneralTab } from "./ClassDetailGeneralTab";
import { ClassDetailFeesTab } from "./ClassDetailFeesTab";
import { ClassDetailScheduleTab } from "./ClassDetailScheduleTab";
import { ClassDetailBudgetTab } from "./ClassDetailBudgetTab";
import { ClassDetailScholarshipTab } from "./ClassDetailScholarshipTab";
import { EMPTY_CLASS } from "./useClassDetailDraft";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => {
  const labels: Record<string, string> = {
    "sessions.classes.detail.fees.add": "Fee Item",
    "sessions.discounts.add": "Discount",
    "sessions.classes.detail.schedule.add": "Schedule Block",
    "sessions.classes.detail.timetable.add": "Period",
    "sessions.classes.detail.budget.add": "Budget Item",
    "sessions.classes.detail.refreshments.add": "Refreshment",
  };
  return {
    useTranslation: () => ({
      t: (key: string) => labels[key] ?? key,
    }),
  };
});

describe("ClassDetail Sub-Tabs & Helpers", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  describe("ClassDetailGeneralTab", () => {
    it("renders general inputs and calls updateDraft", async () => {
      const updateDraft = vi.fn();
      const sampleFaculty: FacultyMember = {
        id: "t1",
        contactId: "c1",
        name: "Ustadh Ali",
        status: "active",
      };
      await act(async () => {
        root.render(
          <ClassDetailGeneralTab
            classDraft={EMPTY_CLASS}
            updateDraft={updateDraft}
            errors={{}}
            allFaculty={[sampleFaculty]}
          />,
        );
      });

      const nameInput = container.querySelector("#class-name") as HTMLInputElement;
      expect(nameInput).not.toBeNull();
      expect(nameInput.value).toBe("");

      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        nativeSetter?.call(nameInput, "Tajweed Class");
        nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(updateDraft).toHaveBeenCalledWith("name", "Tajweed Class");
    });
  });

  describe("ClassDetailFeesTab", () => {
    it("triggers onAddFee and onAddDiscount callbacks", async () => {
      const onAddFee = vi.fn();
      const onAddDiscount = vi.fn();
      await act(async () => {
        root.render(
          <ClassDetailFeesTab
            fees={[]}
            discounts={[]}
            currencySymbol="$"
            onAddFee={onAddFee}
            onRemoveFee={vi.fn()}
            onUpdateFee={vi.fn()}
            onAddDiscount={onAddDiscount}
            onRemoveDiscount={vi.fn()}
            onUpdateDiscount={vi.fn()}
          />,
        );
      });

      const buttons = container.querySelectorAll("button");
      for (const btn of buttons) {
        if (btn.textContent?.includes("Fee Item")) {
          await act(async () => {
            btn.click();
          });
        }
        if (btn.textContent?.includes("Discount")) {
          await act(async () => {
            btn.click();
          });
        }
      }
      expect(onAddFee).toHaveBeenCalledTimes(1);
      expect(onAddDiscount).toHaveBeenCalledTimes(1);
    });
  });

  describe("ClassDetailScheduleTab", () => {
    it("triggers onAddSchedule and onAddPeriod callbacks", async () => {
      const onAddSchedule = vi.fn();
      const onAddPeriod = vi.fn();
      await act(async () => {
        root.render(
          <ClassDetailScheduleTab
            schedules={[]}
            periods={[]}
            allFaculty={[]}
            onAddSchedule={onAddSchedule}
            onRemoveSchedule={vi.fn()}
            onUpdateSchedule={vi.fn()}
            onAddPeriod={onAddPeriod}
            onRemovePeriod={vi.fn()}
            onUpdatePeriod={vi.fn()}
          />,
        );
      });

      const buttons = container.querySelectorAll("button");
      for (const btn of buttons) {
        if (btn.textContent?.includes("Schedule Block")) {
          await act(async () => {
            btn.click();
          });
        }
        if (btn.textContent?.includes("Period")) {
          await act(async () => {
            btn.click();
          });
        }
      }
      expect(onAddSchedule).toHaveBeenCalledTimes(1);
      expect(onAddPeriod).toHaveBeenCalledTimes(1);
    });
  });

  describe("ClassDetailBudgetTab", () => {
    it("triggers onAddBudget and onAddRefreshment callbacks", async () => {
      const onAddBudget = vi.fn();
      const onAddRefreshment = vi.fn();
      await act(async () => {
        root.render(
          <ClassDetailBudgetTab
            budgets={[]}
            refreshments={[]}
            currencySymbol="$"
            onAddBudget={onAddBudget}
            onRemoveBudget={vi.fn()}
            onUpdateBudget={vi.fn()}
            onAddRefreshment={onAddRefreshment}
            onRemoveRefreshment={vi.fn()}
            onUpdateRefreshment={vi.fn()}
          />,
        );
      });

      const buttons = container.querySelectorAll("button");
      for (const btn of buttons) {
        if (btn.textContent?.includes("Budget Item")) {
          await act(async () => {
            btn.click();
          });
        }
        if (btn.textContent?.includes("Refreshment")) {
          await act(async () => {
            btn.click();
          });
        }
      }
      expect(onAddBudget).toHaveBeenCalledTimes(1);
      expect(onAddRefreshment).toHaveBeenCalledTimes(1);
    });
  });

  describe("ClassDetailScholarshipTab", () => {
    it("triggers onUpdateScholarship and onUpdateEligibility on changes", async () => {
      const onUpdateScholarship = vi.fn();
      const onUpdateEligibility = vi.fn();
      await act(async () => {
        root.render(
          <ClassDetailScholarshipTab
            scholarship={{
              id: "s1",
              classId: "c1",
              percentage: 50,
              expiryDate: "2026-12-31",
              eligibility: {
                id: "e1",
                orphan: false,
                job: false,
                business: false,
                property: false,
                familyMembers: 5,
                onJobMembers: 1,
                schoolGoingSiblings: 2,
                residence: "rental",
              },
            }}
            onUpdateScholarship={onUpdateScholarship}
            onUpdateEligibility={onUpdateEligibility}
          />,
        );
      });

      const pctInput = container.querySelector("#sch-pct") as HTMLInputElement;
      expect(pctInput).not.toBeNull();
      expect(pctInput.value).toBe("50");

      const orphanCheckbox = (container.querySelector('button[role="checkbox"]') ||
        container.querySelector('input[type="checkbox"]')) as HTMLElement;
      expect(orphanCheckbox).not.toBeNull();
      await act(async () => {
        orphanCheckbox.click();
      });
      expect(onUpdateEligibility).toHaveBeenCalledWith({ orphan: true });
    });
  });
});
