import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { FACULTY_FIELD_TAB_MAP, useFacultyFormTabs } from "./facultyFormTabs";

const t = ((key: string) => key) as TranslationFunction;

describe("faculty form tabs", () => {
  let container: HTMLElement;
  let root: Root;
  let tabKeys: string[] = [];

  function renderTabs(designationEnabled: boolean): void {
    function Probe() {
      const { visibleTabs } = useFacultyFormTabs({
        isFieldEnabled: (fieldId) =>
          !["designation", "department", "designationId", "departmentId"].includes(fieldId) ||
          designationEnabled,
        errors: {},
        t,
        formInstanceId: "inst-tabs",
      });
      tabKeys = visibleTabs.map((tab) => tab.key);
      return null;
    }
    act(() => {
      root.render(<Probe />);
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("adds a System Account tab after Designation", () => {
    renderTabs(true);
    expect(tabKeys).toEqual(["contact", "employment", "designation", "account"]);
  });

  it("keeps the System Account tab when Designation is disabled", () => {
    renderTabs(false);
    expect(tabKeys).toEqual(["contact", "employment", "account"]);
  });

  it("routes user-account validation errors to the System Account tab", () => {
    for (const field of [
      "user.role",
      "user.email",
      "user.password",
      "user.create",
      "userPassword",
      "userEmail",
      "userRole",
      "userId",
    ]) {
      expect(FACULTY_FIELD_TAB_MAP[field]).toBe("account");
    }
  });
});
