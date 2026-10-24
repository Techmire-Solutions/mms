import { act, type ChangeEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppleContactsPanel } from "@/tenant/features/contacts/hooks/useAppleContactsPanel";

const { notify } = await import("@/lib/notify");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const matchContactIdentity = { mutateAsync: vi.fn(), isPending: false };

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/clientErrorReporting", () => ({ reportClientError: vi.fn() }));
vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    phoneLabels: [],
    emailLabels: [],
    defaultPhoneCountryCode: "+92",
  }),
}));
vi.mock("@/tenant/features/contacts/hooks/useContactMutations", () => ({
  useContactMutations: () => ({ matchContactIdentity }),
}));
vi.mock("@/tenant/features/contacts/hooks/useContacts", () => ({
  useContactsMetrics: () => ({ data: { total: 0 } }),
}));

const VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:Ahmed;Ali;;;",
  "FN:Ali Ahmed",
  "TEL;TYPE=CELL:+923001234567",
  "END:VCARD",
].join("\r\n");

/**
 * Synchronous FileReader stub: the hook only needs `onload` with a text result, and a real
 * (async) reader makes the assertions below race the state flush.
 */
class SyncFileReader {
  onload: ((event: { target: { result: string } }) => void) | null = null;
  readAsText(file?: Blob): void {
    if (file instanceof File && file.name.endsWith(".csv")) {
      this.onload?.({
        target: { result: "First Name,Last Name,Phone Number\nSajjad,Haider,03001234567" },
      });
    } else {
      this.onload?.({ target: { result: VCARD } });
    }
  }
}

describe("useAppleContactsPanel import flow", () => {
  let container: HTMLDivElement;
  let root: Root;
  let panel: ReturnType<typeof useAppleContactsPanel>;

  function renderHook(onImport: (contacts: never[]) => Promise<void>, canWrite = true): void {
    function TestComponent() {
      panel = useAppleContactsPanel({ onImport: onImport as never, canWrite });
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
  }

  /** Feeds a vCard through the hook's file handler so `previewList` is populated. */
  function readPreview(): void {
    const file = new File([VCARD], "contacts.vcf", { type: "text/vcard" });
    const input = document.createElement("input");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    act(() => {
      panel.handleFile({ target: input } as unknown as ChangeEvent<HTMLInputElement>);
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("FileReader", SyncFileReader);
    matchContactIdentity.mutateAsync.mockReset().mockResolvedValue([]);
    matchContactIdentity.isPending = false;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("parses a chosen vCard into the preview list", async () => {
    renderHook(vi.fn().mockResolvedValue(undefined));
    readPreview();

    expect(panel.previewList).toHaveLength(1);
    expect(panel.previewList[0]?.name).toContain("Ali");
  });

  it("stays busy across the write loop, not just the identity match", async () => {
    let releaseWrites: () => void = () => {};
    const onImport = vi.fn(
      (
        _contacts: unknown[],
        options?: { onProgress?: (progress: { imported: number; total: number }) => void },
      ) => {
        options?.onProgress?.({ imported: 1, total: 1 });
        return new Promise<void>((resolve) => {
          releaseWrites = resolve;
        });
      },
    );
    renderHook(onImport);
    readPreview();

    let importPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      importPromise = panel.handleImport();
      await Promise.resolve();
    });

    // The identity match has resolved; the CTA must stay disabled while contacts are written.
    expect(matchContactIdentity.mutateAsync).toHaveBeenCalledTimes(1);
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(panel.importing).toBe(true);
    // Progress from the queued batch is surfaced while the job runs.
    expect(panel.importProgress).toEqual({ imported: 1, total: 1 });

    await act(async () => {
      releaseWrites();
      await importPromise;
    });

    expect(panel.importing).toBe(false);
    expect(panel.importProgress).toBeNull();
    expect(panel.previewList).toHaveLength(0);
    expect(panel.result).toEqual({ imported: 1, skipped: 0 });
  });

  it("ignores a second import click while the first is still writing", async () => {
    const onImport = vi.fn(() => new Promise<void>(() => {}));
    renderHook(onImport);
    readPreview();

    await act(async () => {
      void panel.handleImport();
      await Promise.resolve();
    });
    await act(async () => {
      await panel.handleImport();
    });

    expect(matchContactIdentity.mutateAsync).toHaveBeenCalledTimes(1);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it("does not import without write permission", async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    renderHook(onImport, false);
    readPreview();

    await act(async () => {
      await panel.handleImport();
    });

    expect(matchContactIdentity.mutateAsync).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("clears the busy flag and reports the API detail when the identity match fails", async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    matchContactIdentity.mutateAsync.mockRejectedValue({
      message: "Identity index unavailable",
    });
    renderHook(onImport);
    readPreview();

    await act(async () => {
      await panel.handleImport();
    });

    expect(panel.importing).toBe(false);
    expect(notify.error).toHaveBeenCalledWith("contacts.saveFailed", {
      description: "Identity index unavailable",
    });
    expect(onImport).not.toHaveBeenCalled();
  });

  it("parses a chosen CSV into the preview list with all contact fields", async () => {
    renderHook(vi.fn().mockResolvedValue(undefined));
    const file = new File(
      ["First Name,Last Name,Phone Number\nSajjad,Haider,03001234567"],
      "contacts.csv",
      { type: "text/csv" },
    );
    const input = document.createElement("input");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    act(() => {
      panel.handleFile({ target: input } as unknown as ChangeEvent<HTMLInputElement>);
    });

    expect(panel.previewList).toHaveLength(1);
    expect(panel.previewList[0]?.firstName).toBe("Sajjad");
    expect(panel.previewList[0]?.lastName).toBe("Haider");
    expect(panel.previewList[0]?.phones?.[0]?.number).toBe("03001234567");
  });
});
