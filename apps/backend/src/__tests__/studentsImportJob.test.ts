import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportPipelineContext } from "@mms/shared";

const mockRegisterRunner = vi.fn();
const mockUpsertContact = vi.fn();
const mockFindContacts = vi.fn();
const mockCreateStudent = vi.fn();

vi.mock("../lib/registerModuleCsvImportJobRunner.js", () => ({
  registerModuleCsvImportJobRunner: (...args: unknown[]) => mockRegisterRunner(...args),
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, cb: () => Promise<unknown>) => cb(),
  withTenantRead: async (_tenant: string, cb: () => Promise<unknown>) => cb(),
}));

vi.mock("../contacts/use-cases/contactWriteUseCases.js", () => ({
  upsertContact: (...args: unknown[]) => mockUpsertContact(...args),
}));

vi.mock("../contacts/use-cases/contactLoadUseCases.js", () => ({
  findContactsMatchingUniqueValues: (...args: unknown[]) => mockFindContacts(...args),
}));

vi.mock("../students/use-cases/studentWriteUseCases.js", () => ({
  createStudent: (...args: unknown[]) => mockCreateStudent(...args),
}));

import {
  registerStudentsImportJobRunner,
  studentsImportService,
} from "../students/studentsImportService.js";
import { importStudentRows } from "../students/use-cases/studentImportUseCases.js";

function context(): ImportPipelineContext {
  return {
    tenant: "demo",
    userId: "u-1",
    jobId: "job-1",
    viewerRole: "admin",
    updateProgress: vi.fn().mockResolvedValue(undefined),
  };
}

describe("students CSV import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindContacts.mockResolvedValue([]);
    mockUpsertContact.mockResolvedValue({ contact: { id: "c-1" }, created: true });
    mockCreateStudent.mockResolvedValue({ record: { id: "s-1" }, restored: false });
  });

  it("registers a students:import job runner", () => {
    registerStudentsImportJobRunner();

    expect(mockRegisterRunner).toHaveBeenCalledWith(
      expect.objectContaining({ moduleId: "students", entityNounPlural: "students" }),
    );
  });

  it("exposes an import service bound to the students module", () => {
    expect(typeof studentsImportService.runImport).toBe("function");
    expect(typeof studentsImportService.registerJobRunner).toBe("function");
  });

  it("creates a contact for the row and links the student to it", async () => {
    const result = await importStudentRows(
      [{ name: "Ali Khan", grNumber: "GR-1", phone: "0300-1234567" }],
      context(),
    );

    expect(result).toEqual({ imported: 1, errors: undefined });
    expect(mockUpsertContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ali Khan", firstName: "Ali", phone: "0300-1234567" }),
    );
    expect(mockCreateStudent).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: "c-1", grNumber: "GR-1" }),
      { actorId: "u-1" },
    );
  });

  it("reuses an existing person instead of forking a duplicate contact", async () => {
    mockFindContacts.mockResolvedValue([{ id: "c-existing" }]);

    await importStudentRows([{ name: "Ali Khan", email: "ali@example.com" }], context());

    expect(mockUpsertContact).not.toHaveBeenCalled();
    expect(mockCreateStudent).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: "c-existing" }),
      { actorId: "u-1" },
    );
  });

  it("rejects a row without a name and keeps going", async () => {
    const result = await importStudentRows(
      [{ grNumber: "GR-2" }, { name: "Sara", grNumber: "GR-3" }],
      context(),
    );

    expect(result.imported).toBe(1);
    expect(result.errors).toEqual([{ row: 1, reason: "Name is required" }]);
    expect(mockCreateStudent).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown status before touching the database", async () => {
    const result = await importStudentRows([{ name: "Ali", status: "graduated-ish" }], context());

    expect(result.imported).toBe(0);
    expect(result.errors?.[0]?.reason).toContain("Invalid status");
    expect(mockUpsertContact).not.toHaveBeenCalled();
  });

  it("collects a student-creation failure without failing the batch", async () => {
    mockCreateStudent
      .mockRejectedValueOnce(new Error("A student with this GR number already exists."))
      .mockResolvedValueOnce({ record: { id: "s-2" }, restored: false });

    const result = await importStudentRows(
      [
        { name: "Ali", grNumber: "GR-1" },
        { name: "Sara", grNumber: "GR-2" },
      ],
      context(),
    );

    expect(result.imported).toBe(1);
    expect(result.errors).toEqual([
      { row: 1, reason: "A student with this GR number already exists." },
    ]);
  });
});
