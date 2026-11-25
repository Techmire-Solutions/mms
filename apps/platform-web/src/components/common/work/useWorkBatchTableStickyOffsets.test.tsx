import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useWorkBatchTableStickyOffsets } from "@mms/fe-core/components/useWorkBatchTableStickyOffsets";
import { WORK_TABLE_SELECTION_WIDTH } from "@mms/fe-core/components/workBatchTableWidths";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Offsets = ReturnType<typeof useWorkBatchTableStickyOffsets>;

interface HarnessOptions {
  stickyColumnIds?: string[];
  stickyEndColumnIds?: string[];
  widths: [string, number | undefined][];
  hasSelection?: boolean;
  hasRowActions?: boolean;
  actionsWidth?: number;
}

describe("useWorkBatchTableStickyOffsets", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: Offsets;
  let currentOptions: HarnessOptions;

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function Probe(): React.JSX.Element {
    latest = useWorkBatchTableStickyOffsets({
      stickyColumnIds: currentOptions.stickyColumnIds,
      stickyEndColumnIds: currentOptions.stickyEndColumnIds,
      resolvedWidths: new Map(currentOptions.widths),
      hasSelection: currentOptions.hasSelection ?? false,
      hasRowActions: currentOptions.hasRowActions ?? false,
      actionsWidth: currentOptions.actionsWidth,
    });
    return <span data-testid="probe" />;
  }

  function renderOffsets(options: HarnessOptions): void {
    currentOptions = options;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<Probe />);
    });
  }

  function rerender(): void {
    act(() => {
      root.render(<Probe />);
    });
  }

  it("computes cumulative offsets for start- and end-pinned columns", () => {
    renderOffsets({
      stickyColumnIds: ["name", "status"],
      stickyEndColumnIds: ["actions"],
      widths: [
        ["name", 100],
        ["status", 80],
        ["actions", 112],
      ],
      hasSelection: true,
      hasRowActions: true,
      actionsWidth: 140,
    });

    expect(latest.leftPinnedIds).toEqual(["name", "status"]);
    expect(latest.rightPinnedIds).toEqual(["actions"]);
    // name sits after the 48px selection column; status after name's 100px.
    expect(latest.stickyLeftOffsets).toEqual({
      name: WORK_TABLE_SELECTION_WIDTH,
      status: WORK_TABLE_SELECTION_WIDTH + 100,
    });
    expect(latest.stickyRightOffsets).toEqual({ actions: 140 });
  });

  it("keeps offsets referentially stable when a new resolvedWidths Map carries the same values", () => {
    renderOffsets({
      stickyColumnIds: ["name"],
      widths: [["name", 100]],
    });

    const first = latest;
    rerender();

    expect(latest.stickyLeftOffsets).toBe(first.stickyLeftOffsets);
    expect(latest.stickyRightOffsets).toBe(first.stickyRightOffsets);
  });

  it("recomputes offsets when a pinned column width changes", () => {
    renderOffsets({
      stickyColumnIds: ["name", "status"],
      widths: [
        ["name", 100],
        ["status", 80],
      ],
    });

    currentOptions = {
      stickyColumnIds: ["name", "status"],
      widths: [
        ["name", 100],
        ["status", 60],
      ],
    };
    rerender();

    expect(latest.stickyLeftOffsets).toEqual({ name: 0, status: 100 });
  });

  it("falls back to the unsized-column floor for unresolved widths", () => {
    renderOffsets({
      stickyColumnIds: ["name"],
      widths: [],
    });

    expect(latest.stickyLeftOffsets).toEqual({ name: 0 });
  });
});
