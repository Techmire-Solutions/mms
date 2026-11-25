import { beforeEach, describe, expect, it, vi } from "vitest";

const { getObject, saveObject } = vi.hoisted(() => ({
  getObject: vi.fn(),
  saveObject: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getObject, saveObject }));

import { getOrInitializeCustomWidgets } from "./widgetDefaultsStore";

describe("getOrInitializeCustomWidgets", () => {
  beforeEach(() => {
    getObject.mockReset();
    saveObject.mockReset();
  });

  it("repairs title-cased behavior fields on legacy seeded widgets", () => {
    getObject.mockReturnValue([
      {
        id: "def-card-admin-students",
        title: "",
        category: "Students",
        collection: "Students",
        widgetType: "Card",
        operation: "Count",
        role: "Admin",
        color: "Emerald",
        isPinnedToDashboard: false,
      },
      {
        id: "def-card-admin-fees",
        title: "",
        category: "Financial",
        collection: "Finance_invoices",
        widgetType: "Card",
        operation: "Sum",
        role: "Admin",
        targetField: "Paidamt",
        filterField: "Status",
        filterOperator: "Equals",
        filterValue: "Paid",
        color: "Emerald",
        isPinnedToDashboard: false,
      },
    ]);

    const widgets = getOrInitializeCustomWidgets();
    const studentsCard = widgets.find((widget) => widget.id === "def-card-admin-students");
    const feesCard = widgets.find((widget) => widget.id === "def-card-admin-fees");

    expect(studentsCard).toMatchObject({
      category: "students",
      collection: "students",
      widgetType: "card",
      operation: "count",
      role: "admin",
    });
    expect(feesCard).toMatchObject({
      collection: "finance_invoices",
      operation: "sum",
      targetField: "paidAmt",
      filterField: "status",
      filterOperator: "equals",
      filterValue: "paid",
    });
    expect(saveObject).toHaveBeenCalledWith("kpi_custom_widgets", widgets);
  });
});
