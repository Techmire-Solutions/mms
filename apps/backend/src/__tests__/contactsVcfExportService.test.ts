import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";

const mockLoadContactsPage = vi.fn();
const mockLoadContactFieldConfig = vi.fn();

vi.mock("../contacts/use-cases/contactLoadUseCases.js", () => ({
  loadContactsPage: (...args: unknown[]) => mockLoadContactsPage(...args),
  loadContactsByIds: vi.fn(),
}));

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: (...args: unknown[]) => mockLoadContactFieldConfig(...args),
}));

const {
  mockRegisterBackgroundJobRunner,
  mockResolveTenantExportKey,
  mockUploadStreamToStorage,
  mockSaveStreamedExportArtifact,
} = vi.hoisted(() => ({
  mockRegisterBackgroundJobRunner: vi.fn(),
  mockResolveTenantExportKey: vi.fn(),
  mockUploadStreamToStorage: vi.fn(),
  mockSaveStreamedExportArtifact: vi.fn(),
}));

vi.mock("../services/backgroundJobWorkerService.js", () => ({
  registerBackgroundJobRunner: (...args: unknown[]) => mockRegisterBackgroundJobRunner(...args),
}));
vi.mock("../config/storage.js", () => ({
  resolveTenantExportKey: (...args: unknown[]) => mockResolveTenantExportKey(...args),
  uploadStreamToStorage: (...args: unknown[]) => mockUploadStreamToStorage(...args),
}));
vi.mock("../services/exportArtifactService.js", () => ({
  saveStreamedExportArtifact: (...args: unknown[]) => mockSaveStreamedExportArtifact(...args),
}));

import type { PassThrough } from "node:stream";
import {
  buildContactsVcfExport,
  generateContactsVcfStreamChunks,
} from "../services/contactsVcfExportService.js";
import { registerContactsVcfExportJobRunner } from "../lib/registerContactsVcfExportJobRunner.js";
import type { BackgroundJobRunContext } from "../services/backgroundJobWorkerService.js";

type UploadedArtifact = { key: string; storageType: "local"; url: string };

function makeContext(overrides: Partial<BackgroundJobRunContext> = {}): BackgroundJobRunContext {
  return {
    tenant: "tenant-1",
    userId: "user-1",
    jobId: "job-1",
    updateProgress: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function captureVcfExportRunner(): (
  payload: unknown,
  ctx: BackgroundJobRunContext,
) => Promise<void> {
  mockRegisterBackgroundJobRunner.mockClear();
  registerContactsVcfExportJobRunner();
  expect(mockRegisterBackgroundJobRunner).toHaveBeenCalledWith(
    "contacts:export-vcf",
    expect.any(Function),
  );
  return mockRegisterBackgroundJobRunner.mock.calls[0]?.[1] as (
    payload: unknown,
    ctx: BackgroundJobRunContext,
  ) => Promise<void>;
}

function page(
  contacts: Contact[],
  pageNumber: number,
  total: number,
  hasMore: boolean,
): { contacts: Contact[]; total: number; page: number; limit: number; hasMore: boolean } {
  return { contacts, total, page: pageNumber, limit: 500, hasMore };
}

function mock501ContactPages(): void {
  mockLoadContactsPage
    .mockResolvedValueOnce(
      page(
        Array.from({ length: 500 }, (_, index) => fakeContact(`c${index}`)),
        1,
        501,
        true,
      ),
    )
    .mockResolvedValueOnce(page([fakeContact("c500")], 2, 501, false));
}

function fakeContact(id: string): Contact {
  return {
    id,
    name: `Contact ${id}`,
    firstName: "Contact",
    lastName: id,
    phones: [],
    emails: [],
  };
}

let uploadedContent = "";
let uploadSettled = false;

describe("contactsVcfExportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadContactFieldConfig.mockResolvedValue(null);
    uploadedContent = "";
    uploadSettled = false;
    mockResolveTenantExportKey.mockImplementation(
      (tenant: string, filename: string) => `tenants/${tenant}/exports/${filename}`,
    );
    mockUploadStreamToStorage.mockImplementation((...args: unknown[]) => {
      const key = args[1] as string;
      const stream = args[2] as PassThrough;
      const chunks: Buffer[] = [];
      return new Promise<UploadedArtifact>((resolve, reject) => {
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("error", (error: Error) => {
          uploadSettled = true;
          reject(error);
        });
        stream.on("end", () => {
          uploadedContent = Buffer.concat(chunks).toString("utf8");
          resolve({ key, storageType: "local", url: `/uploads/${key}` });
        });
      });
    });
    mockSaveStreamedExportArtifact.mockResolvedValue(undefined);
  });

  it("joins vCard cards from a single page with CRLF separators", async () => {
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [fakeContact("c1"), fakeContact("c2")],
      total: 2,
      page: 1,
      limit: 500,
      hasMore: false,
    });

    const result = await buildContactsVcfExport();

    expect(result.count).toBe(2);
    expect(result.filename).toBe("contacts.vcf");
    expect(result.vcf).toContain("BEGIN:VCARD");
    expect(result.vcf).toContain("END:VCARD");
    expect(result.vcf).toMatch(/BEGIN:VCARD\r\nVERSION:3\.0/);
    expect(mockLoadContactsPage).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 500, includeDeleted: false }),
    );
  });

  it("omits fields the viewer cannot read before serializing vCards", async () => {
    mockLoadContactFieldConfig.mockResolvedValue({
      version: 1,
      enabledTabs: [],
      requiredTabs: [],
      formTabs: [{ key: "basic", label: "Basic", enabled: true, order: 0 }],
      fields: {
        basic: [
          { key: "firstName", label: "First", type: "text", enabled: true, order: 0 },
          {
            key: "notes",
            label: "Notes",
            type: "textarea",
            enabled: true,
            order: 1,
            permissions: ["admin"],
          },
        ],
      },
    });
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [
        {
          id: "c1",
          name: "Ali Khan",
          firstName: "Ali",
          lastName: "Khan",
          notes: "private note",
          phones: [],
          emails: [],
        },
      ],
      total: 1,
      page: 1,
      limit: 500,
      hasMore: false,
    });

    const teacherExport = await buildContactsVcfExport({ viewerRole: "teacher" });
    expect(teacherExport.vcf).toContain("FN:Ali Khan");
    expect(teacherExport.vcf).not.toContain("NOTE:private note");

    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [
        {
          id: "c1",
          name: "Ali Khan",
          firstName: "Ali",
          lastName: "Khan",
          notes: "private note",
          phones: [],
          emails: [],
        },
      ],
      total: 1,
      page: 1,
      limit: 500,
      hasMore: false,
    });
    const adminExport = await buildContactsVcfExport({ viewerRole: "admin" });
    expect(adminExport.vcf).toContain("NOTE:private note");
  });

  it("paginates across multiple pages until hasMore is false", async () => {
    mockLoadContactsPage
      .mockResolvedValueOnce({
        contacts: [fakeContact("c1")],
        total: 2,
        page: 1,
        limit: 500,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        contacts: [fakeContact("c2")],
        total: 2,
        page: 2,
        limit: 500,
        hasMore: false,
      });

    const result = await buildContactsVcfExport();

    expect(result.count).toBe(2);
    expect(mockLoadContactsPage).toHaveBeenCalledTimes(2);
    expect(mockLoadContactsPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("calls onProgress after each page", async () => {
    mockLoadContactsPage
      .mockResolvedValueOnce({
        contacts: [fakeContact("c1")],
        total: 2,
        page: 1,
        limit: 500,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        contacts: [fakeContact("c2")],
        total: 2,
        page: 2,
        limit: 500,
        hasMore: false,
      });

    const onProgress = vi.fn();
    await buildContactsVcfExport({ onProgress });

    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it("uses a trimmed custom filename", async () => {
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [],
      total: 0,
      page: 1,
      limit: 500,
      hasMore: false,
    });

    const result = await buildContactsVcfExport({ filename: "  ali.vcf  " });

    expect(result.filename).toBe("ali.vcf");
    expect(result.count).toBe(0);
  });

  it("enforces the in-memory cap while streaming instead of after buffering", async () => {
    mockLoadContactsPage
      .mockResolvedValueOnce({
        contacts: [fakeContact("c1"), fakeContact("c2")],
        total: 4,
        page: 1,
        limit: 2,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        contacts: [fakeContact("c3"), fakeContact("c4")],
        total: 4,
        page: 2,
        limit: 2,
        hasMore: false,
      });

    await expect(buildContactsVcfExport({ chunkSize: 2, maxRecords: 3 })).rejects.toMatchObject({
      name: "CsvExportLimitError",
    });
    // The cap trips on the second page — the third/fourth contacts are never read.
    expect(mockLoadContactsPage).toHaveBeenCalledTimes(2);
  });

  it("streams 501 contacts without a cap error", async () => {
    mock501ContactPages();

    const generator = generateContactsVcfStreamChunks({ filename: "bulk.vcf" });
    const chunks: string[] = [];
    let step = await generator.next();
    while (!step.done) {
      chunks.push(step.value);
      step = await generator.next();
    }

    expect(step.value).toEqual({ count: 501, filename: "bulk.vcf" });
    expect((chunks.join("").match(/BEGIN:VCARD/g) ?? []).length).toBe(501);
    expect(mockLoadContactsPage).toHaveBeenCalledTimes(2);
  });

  it("streams the VCF export to storage and completes with the full count", async () => {
    mock501ContactPages();
    const runner = captureVcfExportRunner();
    const ctx = makeContext();

    await runner({ filename: "contacts.vcf", viewerRole: "admin" }, ctx);

    expect(mockResolveTenantExportKey).toHaveBeenCalledWith("tenant-1", "tenant-1_contacts.vcf");
    expect(mockUploadStreamToStorage).toHaveBeenCalledWith(
      "tenant-1",
      "tenants/tenant-1/exports/tenant-1_contacts.vcf",
      expect.anything(),
      "text/vcard; charset=utf-8",
      { signal: ctx.signal },
    );
    expect((uploadedContent.match(/BEGIN:VCARD/g) ?? []).length).toBe(501);
    expect(mockSaveStreamedExportArtifact).toHaveBeenCalledWith("user-1", "job-1", {
      key: "tenants/tenant-1/exports/tenant-1_contacts.vcf",
      storageType: "local",
      filename: "tenant-1_contacts.vcf",
      contentType: "text/vcard; charset=utf-8",
    });
    expect(ctx.complete).toHaveBeenCalledWith({
      label: "Exported 501 contacts",
      progress: { current: 501, total: 501 },
      hasDownload: true,
    });
  });

  it("destroys the stream and settles the upload when the job is aborted", async () => {
    mock501ContactPages();
    const controller = new AbortController();
    const updateProgress = vi.fn().mockImplementation(async (current: number) => {
      if (current > 0) controller.abort();
    });
    const ctx = makeContext({ signal: controller.signal, updateProgress });
    const runner = captureVcfExportRunner();

    await expect(
      runner({ filename: "contacts.vcf", viewerRole: "admin" }, ctx),
    ).rejects.toMatchObject({ name: "AbortError" });

    const stream = mockUploadStreamToStorage.mock.calls[0]?.[2] as PassThrough | undefined;
    expect(stream?.destroyed).toBe(true);
    expect(uploadSettled).toBe(true);
    expect(mockSaveStreamedExportArtifact).not.toHaveBeenCalled();
    expect(ctx.complete).not.toHaveBeenCalled();
  });
});
