import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentTemplate } from "@mms/shared";

const repo = vi.hoisted(() => ({
  getDocumentTemplateRepo: vi.fn(),
  upsertDocumentTemplateRepo: vi.fn(),
  deleteDocumentTemplateRepo: vi.fn(),
  listDocumentTemplatesRepo: vi.fn(),
}));

vi.mock("../db/repositories/documentTemplatesRepository.js", () => repo);

import { documentsRepositoryAdapter } from "../documents/repository/documentsRepositoryAdapter.js";

const template: DocumentTemplate = { pageSize: "A6", elements: [] };
const version = new Date("2026-01-01T00:00:00.000Z");

describe("documentsRepositoryAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards reads, writes and deletes to the document-templates repository", async () => {
    repo.getDocumentTemplateRepo.mockResolvedValue({ template, updatedAt: version });
    repo.upsertDocumentTemplateRepo.mockResolvedValue({ template, updatedAt: version });
    repo.deleteDocumentTemplateRepo.mockResolvedValue(true);
    repo.listDocumentTemplatesRepo.mockResolvedValue([
      { key: "invoice", template, updatedAt: version },
    ]);

    await documentsRepositoryAdapter.getTemplate("demo", "invoice");
    await documentsRepositoryAdapter.saveTemplate("demo", "invoice", template, version);
    await documentsRepositoryAdapter.deleteTemplate("demo", "invoice");
    await documentsRepositoryAdapter.listTemplates("demo");

    expect(repo.getDocumentTemplateRepo).toHaveBeenCalledWith("demo", "invoice");
    // The compare-and-set token must reach the repository untouched.
    expect(repo.upsertDocumentTemplateRepo).toHaveBeenCalledWith(
      "demo",
      "invoice",
      template,
      version,
    );
    expect(repo.deleteDocumentTemplateRepo).toHaveBeenCalledWith("demo", "invoice");
    expect(repo.listDocumentTemplatesRepo).toHaveBeenCalledWith("demo");
  });

  it("resolves null when the repository reports a version conflict", async () => {
    repo.upsertDocumentTemplateRepo.mockResolvedValue(null);

    await expect(
      documentsRepositoryAdapter.saveTemplate("demo", "invoice", template, version),
    ).resolves.toBeNull();
  });
});
