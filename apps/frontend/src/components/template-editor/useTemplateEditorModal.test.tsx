import { describe, expect, it, beforeEach, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useTemplateEditorModal } from "./useTemplateEditorModal";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useTemplateEditorModal Hook", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    return () => {
      if (container) {
        container.remove();
        container = null;
      }
    };
  });

  it("initializes with provided fullscreen setting", async () => {
    let hookResult: ReturnType<typeof useTemplateEditorModal> | undefined;

    function TestComponent({ fullscreen }: { fullscreen: boolean }) {
      hookResult = useTemplateEditorModal({
        initialFullscreen: fullscreen,
        onClose: vi.fn(),
      });
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(<TestComponent fullscreen={true} />);
    });
    expect(hookResult?.isFullscreen).toBe(true);

    await act(async () => {
      root.unmount();
    });

    const root2 = createRoot(container!);
    await act(async () => {
      root2.render(<TestComponent fullscreen={false} />);
    });
    expect(hookResult?.isFullscreen).toBe(false);

    await act(async () => {
      root2.unmount();
    });
  });

  it("toggles fullscreen state via handleToggleFullscreen", async () => {
    let hookResult: ReturnType<typeof useTemplateEditorModal> | undefined;

    function TestComponent() {
      hookResult = useTemplateEditorModal({
        initialFullscreen: false,
        onClose: vi.fn(),
      });
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(<TestComponent />);
    });
    expect(hookResult?.isFullscreen).toBe(false);

    await act(async () => {
      hookResult?.handleToggleFullscreen();
    });
    expect(hookResult?.isFullscreen).toBe(true);

    await act(async () => {
      hookResult?.handleToggleFullscreen();
    });
    expect(hookResult?.isFullscreen).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("calls confirmDiscardPrompt when isDirty is true and aborts if declined", async () => {
    let hookResult: ReturnType<typeof useTemplateEditorModal> | undefined;
    const onClose = vi.fn();
    const confirmDiscardPrompt = vi.fn(() => false);

    function TestComponent() {
      hookResult = useTemplateEditorModal({
        initialFullscreen: true,
        isDirty: true,
        onClose,
        confirmDiscardPrompt,
      });
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(<TestComponent />);
    });

    await act(async () => {
      hookResult?.handleClose();
    });

    expect(confirmDiscardPrompt).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("calls onClose when isDirty is false", async () => {
    let hookResult: ReturnType<typeof useTemplateEditorModal> | undefined;
    const onClose = vi.fn();
    const confirmDiscardPrompt = vi.fn(() => true);

    function TestComponent() {
      hookResult = useTemplateEditorModal({
        initialFullscreen: true,
        isDirty: false,
        onClose,
        confirmDiscardPrompt,
      });
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(<TestComponent />);
    });

    await act(async () => {
      hookResult?.handleClose();
    });

    expect(confirmDiscardPrompt).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("maintains stable handleClose reference across isDirty updates", async () => {
    let hookResult: ReturnType<typeof useTemplateEditorModal> | undefined;
    const handleCloseRefs: (() => void)[] = [];

    function TestComponent({ isDirty }: { isDirty: boolean }) {
      hookResult = useTemplateEditorModal({
        initialFullscreen: true,
        isDirty,
        onClose: vi.fn(),
      });
      if (hookResult) {
        handleCloseRefs.push(hookResult.handleClose);
      }
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(<TestComponent isDirty={false} />);
    });

    await act(async () => {
      root.render(<TestComponent isDirty={true} />);
    });

    expect(handleCloseRefs.length).toBe(2);
    expect(handleCloseRefs[0]).toBe(handleCloseRefs[1]);

    await act(async () => {
      root.unmount();
    });
  });

  it("syncs initialFullscreen prop dynamically when user has not toggled manually", async () => {
    let hookResult: ReturnType<typeof useTemplateEditorModal> | undefined;

    function TestComponent({ fullscreen }: { fullscreen: boolean }) {
      hookResult = useTemplateEditorModal({
        initialFullscreen: fullscreen,
        onClose: vi.fn(),
      });
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(<TestComponent fullscreen={false} />);
    });
    expect(hookResult?.isFullscreen).toBe(false);

    await act(async () => {
      root.render(<TestComponent fullscreen={true} />);
    });
    expect(hookResult?.isFullscreen).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });
});
