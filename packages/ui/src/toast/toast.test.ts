import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast, getToastState, subscribeToToasts } from "./toastStore";

describe("Toast store", () => {
  beforeEach(() => {
    // Reset state
    const state = getToastState();
    state.toasts.forEach((t) => toast({ title: "" }).dismiss());
  });

  it("dispatches and records a new toast", () => {
    const handleUpdate = vi.fn();
    const unsubscribe = subscribeToToasts(handleUpdate);

    const { id } = toast({
      title: "Settings Saved",
      description: "Changes have been written to disk.",
      variant: "success",
    });

    expect(id).toBeDefined();
    expect(handleUpdate).toHaveBeenCalled();

    const currentState = getToastState();
    const created = currentState.toasts.find((t) => t.id === id);
    expect(created).toBeDefined();
    expect(created?.title).toBe("Settings Saved");
    expect(created?.variant).toBe("success");

    unsubscribe();
  });
});
