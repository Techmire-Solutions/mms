import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackgroundJobRecord, Contact } from "@mms/shared";
import { useContactsCrudWriteActions } from "@/tenant/features/contacts/hooks/useContactsCrudWriteActions";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const startServerContactsImport = vi.fn();
const invalidateContacts = vi.fn();
const notifyBulkResult = vi.fn();
const reportClientError = vi.fn();

vi.mock("@/lib/backgroundJobs/startServerContactsImport", () => ({
  startServerContactsImport: (...args: unknown[]) => startServerContactsImport(...args),
}));
vi.mock("@/tenant/features/contacts/hooks/useContactMutations", () => ({
  useContactMutations: () => ({
    upsertContact: { mutateAsync: vi.fn() },
    updateContact: { mutateAsync: vi.fn() },
    mergeContacts: { mutateAsync: vi.fn() },
    bulkTagContacts: { mutateAsync: vi.fn() },
  }),
  useInvalidateContactsQueries: () => invalidateContacts,
}));
vi.mock("@/lib/clientErrorReporting", () => ({
  reportClientError: (...args: unknown[]) => reportClientError(...args),
}));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

const contacts = (count: number): Contact[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `c${index}`,
    firstName: `Contact ${index}`,
    name: `Contact ${index}`,
  })) as Contact[];

const completedJob = (imported: number, received: number): BackgroundJobRecord => ({
  id: "job-import",
  moduleId: "contacts",
  kind: "import",
  status: "completed",
  label: `Imported ${imported} contacts`,
  progress: { current: imported, total: received },
  createdAt: new Date().toISOString(),
});

describe("useContactsCrudWriteActions.importContacts", () => {
  let container: HTMLDivElement;
  let root: Root;
  let actions: ReturnType<typeof useContactsCrudWriteActions>;

  function renderHook(): void {
    function TestComponent() {
      actions = useContactsCrudWriteActions({
        t: ((key: string) => key) as never,
        handleError: vi.fn(),
        notifyBulkResult,
      });
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
    startServerContactsImport.mockReset().mockResolvedValue(completedJob(4, 4));
    invalidateContacts.mockReset();
    notifyBulkResult.mockReset();
    reportClientError.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("queues one job for the batch and refreshes the directory once", async () => {
    renderHook();

    await act(async () => {
      await actions.importContacts(contacts(4));
    });

    expect(startServerContactsImport).toHaveBeenCalledTimes(1);
    expect(startServerContactsImport.mock.calls[0]?.[0]).toMatchObject({
      label: "contacts.jobs.importLabelServer",
    });
    expect(invalidateContacts).toHaveBeenCalledTimes(1);
    expect(notifyBulkResult).toHaveBeenCalledWith(
      4,
      0,
      "contacts.importSuccessOne",
      "contacts.importSuccess",
    );
  });

  it("counts contacts the worker could not import as failures", async () => {
    startServerContactsImport.mockResolvedValue(completedJob(2, 5));
    renderHook();

    await act(async () => {
      await actions.importContacts(contacts(5));
    });

    expect(notifyBulkResult).toHaveBeenCalledWith(
      2,
      3,
      "contacts.importSuccessOne",
      "contacts.importSuccess",
    );
    expect(invalidateContacts).toHaveBeenCalledTimes(1);
  });

  it("chunks larger imports into capped jobs", async () => {
    startServerContactsImport.mockImplementation(async (options: { contacts: Contact[] }) =>
      completedJob(options.contacts.length, options.contacts.length),
    );
    renderHook();

    await act(async () => {
      await actions.importContacts(contacts(600));
    });

    expect(startServerContactsImport).toHaveBeenCalledTimes(2);
    const [firstBatch, secondBatch] = startServerContactsImport.mock.calls.map(
      (call) => (call[0] as { contacts: Contact[] }).contacts,
    );
    expect(firstBatch).toHaveLength(500);
    expect(secondBatch).toHaveLength(100);
    expect(notifyBulkResult).toHaveBeenCalledWith(
      600,
      0,
      "contacts.importSuccessOne",
      "contacts.importSuccess",
    );
    expect(invalidateContacts).toHaveBeenCalledTimes(1);
  });

  it("reports the whole batch as failed when the job cannot be queued", async () => {
    startServerContactsImport.mockRejectedValue(new Error("queue unavailable"));
    renderHook();

    await act(async () => {
      await actions.importContacts(contacts(3));
    });

    expect(reportClientError).toHaveBeenCalledWith(expect.any(Error), {
      scope: "contacts.import_job",
    });
    expect(notifyBulkResult).toHaveBeenCalledWith(
      0,
      3,
      "contacts.importSuccessOne",
      "contacts.importSuccess",
    );
    expect(invalidateContacts).not.toHaveBeenCalled();
  });

  it("does nothing for an empty list", async () => {
    renderHook();

    await act(async () => {
      await actions.importContacts([]);
    });

    expect(startServerContactsImport).not.toHaveBeenCalled();
    expect(notifyBulkResult).not.toHaveBeenCalled();
  });

  it("reports overall progress across batches", async () => {
    startServerContactsImport.mockImplementation(
      async (options: { contacts: Contact[]; onProgress?: (job: BackgroundJobRecord) => void }) => {
        options.onProgress?.(completedJob(2, options.contacts.length));
        options.onProgress?.(completedJob(options.contacts.length, options.contacts.length));
        return completedJob(options.contacts.length, options.contacts.length);
      },
    );
    renderHook();
    const onProgress = vi.fn();

    await act(async () => {
      await actions.importContacts(contacts(600), { onProgress });
    });

    // Second batch starts from the first batch's 500, not from zero.
    expect(onProgress).toHaveBeenCalledWith({ imported: 502, total: 600 });
    expect(onProgress).toHaveBeenLastCalledWith({ imported: 600, total: 600 });
  });

  it("calculates exact failed count when a later batch throws without double-counting", async () => {
    let callCount = 0;
    startServerContactsImport.mockImplementation(async (options: { contacts: Contact[] }) => {
      callCount++;
      if (callCount === 1) return completedJob(480, options.contacts.length);
      throw new Error("Batch 2 network failure");
    });
    renderHook();

    await act(async () => {
      await actions.importContacts(contacts(600));
    });

    expect(notifyBulkResult).toHaveBeenCalledWith(
      480,
      120,
      "contacts.importSuccessOne",
      "contacts.importSuccess",
    );
    expect(invalidateContacts).toHaveBeenCalledTimes(1);
  });
});
