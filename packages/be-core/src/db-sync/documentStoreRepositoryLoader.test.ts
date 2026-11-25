import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DocumentStoreRepositoryLoaderNotConfiguredError,
  configureDocumentStoreRepositoryLoader,
  loadDocumentStoreRepository,
} from "./documentStoreRepositoryLoader.js";

/**
 * The legacy document store resolves repository helpers through an injected
 * importer. It must fail closed: silently skipping the relational mirror would
 * leave the relational tables stale while the document store reports success.
 */
describe("documentStoreRepositoryLoader port", () => {
  afterEach(() => {
    configureDocumentStoreRepositoryLoader(null);
  });

  it("fails closed with the offending path when unconfigured", async () => {
    await expect(
      loadDocumentStoreRepository("./repositories/contactRepository.js"),
    ).rejects.toBeInstanceOf(DocumentStoreRepositoryLoaderNotConfiguredError);
  });

  it("names the missing path in the error message", async () => {
    await expect(
      loadDocumentStoreRepository("./repositories/studentRepository.js"),
    ).rejects.toThrow(/studentRepository\.js/);
  });

  it("delegates with the exact specifier and returns the module", async () => {
    const repoModule = { listStudentsSnapshot: vi.fn() };
    const loader = vi.fn(async () => repoModule);
    configureDocumentStoreRepositoryLoader(loader);

    await expect(loadDocumentStoreRepository("./repositories/studentRepository.js")).resolves.toBe(
      repoModule,
    );
    expect(loader).toHaveBeenCalledWith("./repositories/studentRepository.js");
  });

  it("propagates a loader rejection (a broken repository must not read as success)", async () => {
    configureDocumentStoreRepositoryLoader(async () => {
      throw new Error("repository module missing");
    });

    await expect(loadDocumentStoreRepository("./repositories/x.js")).rejects.toThrow(
      "repository module missing",
    );
  });

  it("can be cleared back to the fail-closed state", async () => {
    configureDocumentStoreRepositoryLoader(async () => ({ ok: true as const }));
    await expect(loadDocumentStoreRepository("./repositories/x.js")).resolves.toEqual({ ok: true });

    configureDocumentStoreRepositoryLoader(null);
    await expect(loadDocumentStoreRepository("./repositories/x.js")).rejects.toBeInstanceOf(
      DocumentStoreRepositoryLoaderNotConfiguredError,
    );
  });
});
