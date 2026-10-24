import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContactDuplicateCheck } from "./useContactDuplicateCheck";
import { apiContract } from "@/lib/api";
import type { Contact } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/api", () => ({
  apiContract: {
    contacts: {
      duplicateCheck: vi.fn(),
    },
  },
}));

function TestHarness({
  open,
  contactId,
  contactDraft,
  onValue,
}: {
  open: boolean;
  contactId?: string | number;
  contactDraft: Partial<Contact>;
  onValue: (val: number) => void;
}) {
  const count = useContactDuplicateCheck({ open, contactId, contactDraft });
  onValue(count);
  return <div data-testid="count">{count}</div>;
}

describe("useContactDuplicateCheck", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("returns 0 and skips check when open is false", async () => {
    let observedCount = -1;

    await act(async () => {
      root.render(
        <TestHarness
          open={false}
          contactDraft={{ name: "John Doe" }}
          onValue={(val) => {
            observedCount = val;
          }}
        />,
      );
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(observedCount).toBe(0);
    expect(apiContract.contacts.duplicateCheck).not.toHaveBeenCalled();
  });

  it("returns 0 and skips check when contactId is present (edit mode)", async () => {
    let observedCount = -1;

    await act(async () => {
      root.render(
        <TestHarness
          open={true}
          contactId="contact-123"
          contactDraft={{ name: "John Doe" }}
          onValue={(val) => {
            observedCount = val;
          }}
        />,
      );
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(observedCount).toBe(0);
    expect(apiContract.contacts.duplicateCheck).not.toHaveBeenCalled();
  });

  it("calls duplicateCheck and updates count after debounce", async () => {
    vi.mocked(apiContract.contacts.duplicateCheck).mockResolvedValueOnce({
      status: 200,
      body: { matchCount: 3 },
      headers: new Headers(),
    } as unknown as Awaited<ReturnType<typeof apiContract.contacts.duplicateCheck>>);

    let observedCount = -1;

    await act(async () => {
      root.render(
        <TestHarness
          open={true}
          contactDraft={{ name: "Ali Raza" }}
          onValue={(val) => {
            observedCount = val;
          }}
        />,
      );
    });

    expect(observedCount).toBe(0);

    await act(async () => {
      vi.advanceTimersByTime(650);
    });

    expect(apiContract.contacts.duplicateCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { contact: { name: "Ali Raza" } },
        signal: expect.any(AbortSignal),
        fetchOptions: expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      }),
    );
    expect(observedCount).toBe(3);
  });

  it("aborts in-flight duplicateCheck on unmount", async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(apiContract.contacts.duplicateCheck).mockImplementation(async (args) => {
      capturedSignal = (args as { signal?: AbortSignal })?.signal;
      return new Promise(() => {}); // never resolves
    });

    await act(async () => {
      root.render(
        <TestHarness open={true} contactDraft={{ name: "Fatima Noor" }} onValue={() => {}} />,
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(650);
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    await act(async () => {
      root.unmount();
    });

    expect(capturedSignal?.aborted).toBe(true);
  });
});
