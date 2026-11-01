import { describe, expect, it } from "vitest";
import {
  isSeededDashboardWidget,
  resolveWidgetTitle,
  resolveWidgetSubText,
} from "./dashboardWidgets";

describe("dashboardWidgets", () => {
  const mockT = (key: string) => `translated:${key}`;

  it("identifies seeded default widget IDs", () => {
    expect(isSeededDashboardWidget("def-card-admin-students")).toBe(true);
    expect(isSeededDashboardWidget("custom-123")).toBe(false);
  });

  it("resolves widget title via translation key for seeded default widget", () => {
    const title = resolveWidgetTitle(
      {
        id: "def-card-admin-students",
        title: "Total Students Default",
      },
      mockT,
    );
    expect(title).toBe("translated:widget.title.totalStudents");
  });

  it("falls back to custom title when no translation key exists", () => {
    const title = resolveWidgetTitle(
      {
        id: "custom-card-99",
        title: "Custom Title",
      },
      mockT,
    );
    expect(title).toBe("Custom Title");
  });

  it("resolves widget subtitle via fixedSubTextKey or default subtitle keys", () => {
    const subText = resolveWidgetSubText(
      {
        id: "def-card-admin-students",
        title: "Students",
      },
      mockT,
    );
    expect(subText).toBe("translated:widget.subtitle.registeredStudents");
  });

  it("falls back to fixedSubText when no translation key is specified", () => {
    const subText = resolveWidgetSubText(
      {
        id: "custom-widget",
        title: "Custom",
        fixedSubText: "Custom Subtitle",
      },
      mockT,
    );
    expect(subText).toBe("Custom Subtitle");
  });

  it("suppresses a subtitle that only repeats the title", () => {
    // Regression guard for the 2026-10-31 review: seeded contacts/sessions cards
    // rendered "Total Contacts" over "Total contacts" (and the same for sessions).
    const sameT = () => "Total Contacts";
    const subText = resolveWidgetSubText({ id: "def-card-admin-contacts", title: "" }, sameT);
    expect(subText).toBe("");
  });

  it("matches title and subtitle case- and whitespace-insensitively", () => {
    const subText = resolveWidgetSubText(
      {
        id: "custom-widget",
        title: "Total Contacts",
        fixedSubText: "  Total contacts  ",
      },
      mockT,
    );
    expect(subText).toBe("");
  });
});
