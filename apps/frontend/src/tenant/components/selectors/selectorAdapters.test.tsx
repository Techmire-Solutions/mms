import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegistryPersonSelect } from "./RegistryPersonSelect";
import { UserActorSelect } from "./UserActorSelect";

const queries = vi.hoisted(() => ({ students: vi.fn(), faculty: vi.fn(), users: vi.fn() }));
vi.mock("@/tenant/hooks/collections/students", () => ({
  useStudentsContractList: queries.students,
}));
vi.mock("@/tenant/hooks/collections/faculty", () => ({ useFacultyContractList: queries.faculty }));
vi.mock("@/tenant/hooks/collections/users", () => ({ useUsersPaginated: queries.users }));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me", name: "Current user" } }),
}));
vi.mock("@/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("tenant select adapters", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queries.students.mockReturnValue({
      data: {
        body: {
          students: [
            { id: "b", name: "Zain" },
            { id: "a", name: "Ali" },
          ],
          hasMore: true,
        },
      },
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
    queries.faculty.mockReturnValue({
      data: { body: { faculty: [{ id: "f", name: "Teacher" }] } },
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
    queries.users.mockReturnValue({
      data: { users: [{ id: "u", name: "Other user" }] },
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("uses only the selected registry query and retains a selection outside its page", () => {
    act(() =>
      root.render(
        <RegistryPersonSelect
          kind="student"
          value="saved"
          label="Student"
          excludeIds={["b"]}
          onChange={vi.fn()}
        />,
      ),
    );
    expect(queries.students).toHaveBeenLastCalledWith({ page: 1, limit: 50, search: "" }, true);
    expect(queries.faculty).toHaveBeenLastCalledWith({ page: 1, limit: 50, search: "" }, false);
    expect([...container.querySelectorAll("option")].map((option) => option.value)).toEqual([
      "",
      "saved",
      "a",
    ]);
    expect(container.querySelector("select")?.value).toBe("saved");
    expect(container.textContent).toContain("registryPerson.refineSearch");
  });

  it("keeps the authenticated-user fallback and supplies selected user names", () => {
    const onChange = vi.fn();
    act(() => root.render(<UserActorSelect value="" label="Actor" onChange={onChange} />));
    const select = container.querySelector("select")!;
    expect(select.value).toBe("me");
    expect(select.selectedOptions[0].textContent).toBe("Current user");
    act(() => {
      select.value = "u";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith("u", "Other user");
  });
});
