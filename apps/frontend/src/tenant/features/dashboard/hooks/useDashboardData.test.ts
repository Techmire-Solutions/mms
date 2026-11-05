import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_MODULE_MANIFEST,
  CONTACTS_MODULE_MANIFEST,
  STUDENTS_MODULE_MANIFEST,
  type Permission,
} from "@mms/shared";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { resolveDashboardMetricSources } from "./dashboardMetricSources";

const allowAll = () => true;

function widget(overrides: Partial<CustomWidget>): CustomWidget {
  return {
    id: "w-1",
    title: "Widget",
    category: "contacts",
    collection: "contacts",
    widgetType: "chart",
    operation: "count",
    color: "emerald",
    isPinnedToDashboard: true,
    role: "admin",
    ...overrides,
  } as CustomWidget;
}

describe("resolveDashboardMetricSources", () => {
  it("loads a collection metric only when its widget is visible and the module is enabled", () => {
    const sources = resolveDashboardMetricSources({
      widgets: [widget({ collection: "contacts" })],
      dashboardRole: "admin",
      enabledModules: {},
      can: allowAll,
    });
    expect(sources.contacts).toBe(true);
  });

  it("never loads a disabled module even when the role has the permission", () => {
    const sources = resolveDashboardMetricSources({
      widgets: [widget({ collection: "contacts" })],
      dashboardRole: "admin",
      enabledModules: { contacts: false },
      can: allowAll,
    });
    expect(sources.contacts).toBe(false);
  });

  it("never loads a module whose read permission the caller lacks", () => {
    const denyContacts = (permission: Permission) =>
      permission !== CONTACTS_MODULE_MANIFEST.permissions.read;
    const sources = resolveDashboardMetricSources({
      widgets: [widget({ collection: "contacts" })],
      dashboardRole: "accountant",
      enabledModules: {},
      can: denyContacts,
    });
    expect(sources.contacts).toBe(false);
  });

  it("gives the admin shell its student banner metric even without a student widget", () => {
    const sources = resolveDashboardMetricSources({
      widgets: [],
      dashboardRole: "admin",
      enabledModules: {},
      can: allowAll,
    });
    expect(sources.students).toBe(true);
    expect(sources.contacts).toBe(false);
  });

  it("resolves the accounting source from an accounting-tagged widget", () => {
    const accountingWidget = widget({
      category: ACCOUNTING_MODULE_MANIFEST.moduleId,
      collection: "finance_invoices",
    });

    expect(
      resolveDashboardMetricSources({
        widgets: [accountingWidget],
        dashboardRole: "accountant",
        enabledModules: {},
        can: allowAll,
      }).accounting,
    ).toBe(true);

    expect(
      resolveDashboardMetricSources({
        widgets: [accountingWidget],
        dashboardRole: "accountant",
        enabledModules: { accounting: false },
        can: allowAll,
      }).accounting,
    ).toBe(false);
  });

  it("splits seeded KPI cards out of the per-collection aggregate requests", () => {
    const sources = resolveDashboardMetricSources({
      widgets: [
        widget({
          id: "def-card-admin-students",
          widgetType: "card",
          collection: "students",
          role: "admin",
        }),
        widget({ id: "custom-chart", widgetType: "chart", collection: "students" }),
      ],
      dashboardRole: "admin",
      enabledModules: {},
      can: allowAll,
    });

    expect(sources.collectionWidgets.students.map((w) => w.id)).toEqual(["custom-chart"]);
  });

  it("treats a missing permission check as permitted (backend still enforces)", () => {
    const sources = resolveDashboardMetricSources({
      widgets: [widget({ collection: "contacts" })],
      dashboardRole: "admin",
      enabledModules: {},
      can: undefined,
    });
    expect(sources.contacts).toBe(true);
    expect(STUDENTS_MODULE_MANIFEST.permissions.read).toBe("students.read");
  });
});
