import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskServerFilterInput, TaskServerFilters } from "../lib/tasksServerFilters";
import { useTaskServerFiltersSync } from "./useTaskServerFiltersSync";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderSync(input: TaskServerFilterInput) {
  const onFiltersChange = vi.fn<(filters: TaskServerFilters) => void>();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  const SyncHost = ({ input }: { input: TaskServerFilterInput }) => {
    useTaskServerFiltersSync(input, onFiltersChange);
    return null;
  };

  act(() => root.render(<SyncHost input={input} />));
  return {
    onFiltersChange,
    rerender: (next: TaskServerFilterInput) => {
      act(() => root.render(<SyncHost input={next} />));
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const baseInput: TaskServerFilterInput = {
  quickFilter: "all",
  search: "",
  statusFilter: [],
  priorityFilter: [],
  currentUserId: "user-1",
};

describe("useTaskServerFiltersSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never reports on the first render — the owner already starts empty", () => {
    const { onFiltersChange, unmount } = renderSync({
      ...baseInput,
      quickFilter: "mine",
    });
    expect(onFiltersChange).not.toHaveBeenCalled();
    unmount();
  });

  it("reports the mapped server filters once when the model changes", () => {
    const { onFiltersChange, rerender, unmount } = renderSync(baseInput);
    rerender({ ...baseInput, statusFilter: ["todo", "blocked"] });
    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: "todo,blocked" }),
    );
    unmount();
  });

  it("maps the quick filters onto their server predicates", () => {
    const { onFiltersChange, rerender, unmount } = renderSync(baseInput);
    rerender({ ...baseInput, quickFilter: "open" });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: "todo,in_progress,in_review,blocked" }),
    );

    rerender({ ...baseInput, quickFilter: "overdue" });
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ overdue: true }));

    rerender({ ...baseInput, quickFilter: "mine" });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ assignedToUserId: "user-1" }),
    );
    unmount();
  });

  it("stays silent when the same model re-renders", () => {
    const { onFiltersChange, rerender, unmount } = renderSync(baseInput);
    rerender({ ...baseInput, search: "exam" });
    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    rerender({ ...baseInput, search: "exam" });
    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    unmount();
  });
});
