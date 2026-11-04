import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BackgroundJobRecord, Contact } from "@mms/shared";
import { ContactsCsvImportDialog } from "./ContactsCsvImportDialog";

vi.mock("@/lib/download", () => ({
  triggerFileDownload: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/hooks/useTranslation", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});

const mockStartServerImport = vi.fn();

vi.mock("@/lib/backgroundJobs/startServerContactsImport", () => ({
  startServerContactsImport: (...args: unknown[]) => mockStartServerImport(...args),
}));

interface ContactsImportRequest {
  contacts: Contact[];
  label: string;
  onProgress?: (job: BackgroundJobRecord) => void;
}

const twoRowCsv = [
  '"Full Name","Phone Number","Email Address","City"',
  '"Syed Ali","+923001234567","ali@example.com","Karachi"',
  '"Zayd ibn Ali","+923009876543","zayd@example.com","Lahore"',
].join("\n");

describe("ContactsCsvImportDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    mockStartServerImport.mockImplementation(
      async (options: ContactsImportRequest): Promise<BackgroundJobRecord> => {
        const job: BackgroundJobRecord = {
          id: `job-contacts-${options.contacts.length}`,
          moduleId: "contacts",
          kind: "import",
          status: "completed",
          label: `Imported ${options.contacts.length} contacts`,
          progress: { current: options.contacts.length, total: options.contacts.length },
          createdAt: "2026-11-02T00:00:00.000Z",
        };
        options.onProgress?.(job);
        return job;
      },
    );
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  function findButton(label: string): HTMLButtonElement | undefined {
    return Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes(label),
    );
  }

  async function selectCsv(content: string, fileName = "contacts.csv"): Promise<void> {
    const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeDefined();
    const file = new File([content], fileName, { type: "text/csv" });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [file],
        writable: true,
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async function clickImport(label: string): Promise<void> {
    const importBtn = findButton(label);
    expect(importBtn).toBeDefined();

    await act(async () => {
      importBtn?.click();
      // Let the batched submit promise chain settle before rendering assertions.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("renders nothing when closed or without write permission", () => {
    act(() => {
      root.render(<ContactsCsvImportDialog open={false} onClose={vi.fn()} canWrite={true} />);
    });
    expect(document.body.textContent).toBe("");

    act(() => {
      root.render(<ContactsCsvImportDialog open={true} onClose={vi.fn()} canWrite={false} />);
    });
    expect(document.body.textContent).toBe("");
  });

  it("renders contact import modal and triggers template download from SSOT schema", async () => {
    const { triggerFileDownload } = await import("@/lib/download");

    act(() => {
      root.render(<ContactsCsvImportDialog open={true} onClose={vi.fn()} canWrite={true} />);
    });

    expect(document.body.textContent).toContain("Import");
    expect(document.body.textContent).toContain("Download CSV Template");

    const templateBtn = findButton("Download CSV Template");
    expect(templateBtn).toBeDefined();

    act(() => {
      templateBtn?.click();
    });

    expect(triggerFileDownload).toHaveBeenCalledWith(expect.any(Blob), "contacts.csv");
  });

  it("submits a 2-row file as one contacts batch and never posts {rows}", async () => {
    act(() => {
      root.render(<ContactsCsvImportDialog open={true} onClose={vi.fn()} canWrite={true} />);
    });

    await selectCsv(twoRowCsv, "two_contacts.csv");

    expect(document.body.textContent).toContain("2 valid record(s) ready to import");
    await clickImport("Import 2 Records");

    expect(mockStartServerImport).toHaveBeenCalledTimes(1);
    const request = mockStartServerImport.mock.calls[0]?.[0] as ContactsImportRequest;
    expect(request.contacts).toHaveLength(2);
    expect(request.contacts[0]).toMatchObject({
      name: "Syed Ali",
      firstName: "Syed",
      lastName: "Ali",
      phone: "+923001234567",
      email: "ali@example.com",
      city: "Karachi",
    });
    expect(request.contacts[1]).toMatchObject({
      name: "Zayd ibn Ali",
      firstName: "Zayd",
      lastName: "ibn Ali",
    });
    expect(request).not.toHaveProperty("rows");
    expect(request).not.toHaveProperty("body");
    expect(document.body.textContent).toContain("Imported 2 of 2 contacts");
  });

  it("chunks a 501-row file into 500 + 1 contacts batches", async () => {
    act(() => {
      root.render(<ContactsCsvImportDialog open={true} onClose={vi.fn()} canWrite={true} />);
    });

    const rows = Array.from(
      { length: 501 },
      (_, index) =>
        `"Contact ${index + 1}","+92300${String(index).padStart(7, "0")}","contact${index + 1}@example.com"`,
    );
    const csv = ['"Full Name","Phone Number","Email Address"', ...rows].join("\n");

    await selectCsv(csv, "large_contacts.csv");

    expect(document.body.textContent).toContain("501 valid record(s) ready to import");
    await clickImport("Import 501 Records");

    expect(mockStartServerImport).toHaveBeenCalledTimes(2);
    const first = mockStartServerImport.mock.calls[0]?.[0] as ContactsImportRequest;
    const second = mockStartServerImport.mock.calls[1]?.[0] as ContactsImportRequest;
    expect(first.contacts).toHaveLength(500);
    expect(second.contacts).toHaveLength(1);
    expect(document.body.textContent).toContain("Imported 501 of 501 contacts");
  });

  it("surfaces a failed import and keeps the dialog open when the starter rejects", async () => {
    const { notify } = await import("@/lib/notify");
    const onClose = vi.fn();

    act(() => {
      root.render(<ContactsCsvImportDialog open={true} onClose={onClose} canWrite={true} />);
    });

    await selectCsv(twoRowCsv, "two_contacts.csv");
    mockStartServerImport.mockRejectedValueOnce(new Error("network down"));

    await clickImport("Import 2 Records");

    expect(notify.error).toHaveBeenCalledWith("Import failed", { description: "network down" });
    expect(notify.success).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("two_contacts.csv");
    expect(findButton("Import 2 Records")).toBeDefined();
    expect(document.body.textContent).not.toContain("Imported 2 of 2 contacts");
  });
});
