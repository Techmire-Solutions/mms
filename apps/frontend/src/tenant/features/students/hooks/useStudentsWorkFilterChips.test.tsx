import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  useStudentsWorkFilterChips,
  type UseStudentsWorkFilterChipsParams,
} from "./useStudentsWorkFilterChips";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => `[${key}]`,
    dir: "ltr",
    language: "en",
    isLoading: false,
    isRtl: false,
  }),
}));

function renderHookHelper(props: UseStudentsWorkFilterChipsParams) {
  let hookResult: ReturnType<typeof useStudentsWorkFilterChips> = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent(currentProps: UseStudentsWorkFilterChipsParams) {
    hookResult = useStudentsWorkFilterChips(currentProps);
    return null;
  }

  act(() => {
    root.render(<TestComponent {...props} />);
  });

  return {
    getResult: () => hookResult,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useStudentsWorkFilterChips", () => {
  it("returns chips for active status and gender filters and triggers callbacks", () => {
    const onToggleStatus = vi.fn();
    const onGenderChange = vi.fn();

    const { getResult, cleanup } = renderHookHelper({
      studentFilterStatus: ["active"],
      studentFilterGender: "male",
      onToggleStatus,
      onGenderChange,
    });

    const chips = getResult();
    expect(chips.length).toBeGreaterThan(0);
    const statusChip = chips.find((chip) => chip.key.startsWith("status"));
    const genderChip = chips.find((chip) => chip.key.startsWith("gender"));

    expect(statusChip).toBeDefined();
    expect(genderChip).toBeDefined();

    act(() => {
      statusChip?.onRemove?.();
    });
    expect(onToggleStatus).toHaveBeenCalledWith("active");

    act(() => {
      genderChip?.onRemove?.();
    });
    expect(onGenderChange).toHaveBeenCalledWith("");

    cleanup();
  });

  it("returns empty chips array when no filters are set", () => {
    const { getResult, cleanup } = renderHookHelper({
      studentFilterStatus: [],
      studentFilterGender: "",
      onToggleStatus: vi.fn(),
      onGenderChange: vi.fn(),
    });

    expect(getResult()).toEqual([]);
    cleanup();
  });
});
