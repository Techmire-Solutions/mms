import { describe, expect, it, vi } from "vitest";
import type React from "react";
import { notify, NOTIFY_DURATION } from "../notify";

const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  toast: (options: unknown) => mockToast(options),
}));

describe("notify.archivedWithUndo (§7.8 Optimistic Soft-Delete)", () => {
  it("dispatches toast with 8000ms duration, default variant, and Undo action", async () => {
    mockToast.mockReset();
    const onUndo = vi.fn().mockResolvedValue(undefined);

    notify.archivedWithUndo("Record archived", onUndo, {
      undoLabel: "Undo",
      description: "Item was moved to trash",
    });

    expect(mockToast).toHaveBeenCalledTimes(1);
    const toastArgs = mockToast.mock.calls[0][0] as {
      title: string;
      description?: string;
      variant: string;
      duration: number;
      action: React.ReactElement;
    };

    expect(toastArgs.title).toBe("Record archived");
    expect(toastArgs.description).toBe("Item was moved to trash");
    expect(toastArgs.variant).toBe("default");
    expect(toastArgs.duration).toBe(NOTIFY_DURATION.long);
    expect(toastArgs.action).toBeDefined();

    // Verify clicking the Undo action calls onUndo
    const actionProps = toastArgs.action.props as {
      onClick: () => void;
      onKeyDown: (e: React.KeyboardEvent) => void;
      children: React.ReactNode;
    };
    expect(actionProps.children).toBe("Undo");

    actionProps.onClick();
    expect(onUndo).toHaveBeenCalledTimes(1);

    // Verify accessible keyboard interaction (Enter and Space)
    const preventDefault = vi.fn();
    actionProps.onKeyDown({ key: "Enter", preventDefault } as unknown as React.KeyboardEvent);
    expect(preventDefault).toHaveBeenCalled();
    expect(onUndo).toHaveBeenCalledTimes(2);

    const preventDefaultSpace = vi.fn();
    actionProps.onKeyDown({
      key: " ",
      preventDefault: preventDefaultSpace,
    } as unknown as React.KeyboardEvent);
    expect(preventDefaultSpace).toHaveBeenCalled();
    expect(onUndo).toHaveBeenCalledTimes(3);
  });
});
