import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_FACULTY_USER_ROLE } from "@mms/contracts";
import { useFacultyAssignableRolesSync } from "./useFacultyFormSync";
import type { FacultyUserAccountDraft } from "@/tenant/features/faculty/components/FacultyUserAccountSection";

describe("useFacultyAssignableRolesSync", () => {
  let container: HTMLElement;
  let root: Root;
  let draft: FacultyUserAccountDraft;

  function renderSync(
    designationAssignableRoles: string[],
    initial: FacultyUserAccountDraft,
  ): void {
    function TestComponent() {
      const [state, setState] = useState(initial);
      useFacultyAssignableRolesSync({
        facultyDraft: { designationAssignableRoles },
        userAccountDraft: state,
        setUserAccountDraft: setState,
      });
      draft = state;
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
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

  it("resets the role to the assignable role when out of range", () => {
    renderSync(["teacher"], { enabled: true, role: "staff", setupMethod: "password" });
    expect(draft.enabled).toBe(true);
    expect(draft.role).toBe("teacher");
  });

  it("disables the account and resets the role when there is no assignable role", () => {
    renderSync([], { enabled: true, role: "teacher", setupMethod: "password" });
    expect(draft.enabled).toBe(false);
    expect(draft.role).toBe(DEFAULT_FACULTY_USER_ROLE);
  });

  it("leaves a disabled account untouched when there is no assignable role", () => {
    renderSync([], {
      enabled: false,
      role: DEFAULT_FACULTY_USER_ROLE,
      setupMethod: "password",
    });
    expect(draft.enabled).toBe(false);
    expect(draft.role).toBe(DEFAULT_FACULTY_USER_ROLE);
  });
});
