import React, { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import type { DocumentTemplate } from "@mms/shared";
import {
  DOCUMENT_TEMPLATES_QUERY_KEY_ROOT,
  DocumentTemplateConflictError,
  documentTemplateQueryKey,
  fetchDocumentTemplateLayout,
  useDocumentTemplate,
  useSaveDocumentTemplate,
} from "./useDocumentTemplates";
import { readCachedDocumentTemplate, writeCachedDocumentTemplate } from "./documentTemplateCache";
import * as api from "./documentTemplatesApi";
import { createTestQueryClient } from "@/test/queryClientTestUtils";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface SamplePayload {
  title: string;
}

const VERSION = "2026-01-01T00:00:00.000Z";
const NEXT_VERSION = "2026-01-02T00:00:00.000Z";

const fallback: DocumentTemplate<SamplePayload> = {
  pageSize: "A6",
  elements: [{ id: "el-1", type: "text", label: "Title", x: 0, y: 0, w: 10, h: 10 }],
};

const serverTemplate: DocumentTemplate<SamplePayload> = { ...fallback, pageSize: "A5" };

describe("document template query layer", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("builds a consistent query key hierarchy", () => {
    expect(documentTemplateQueryKey("invoice_template")).toEqual([
      ...DOCUMENT_TEMPLATES_QUERY_KEY_ROOT,
      "invoice_template",
    ]);
  });

  it("returns the server layout and its version", async () => {
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue({
      template: serverTemplate,
      updatedAt: VERSION,
    } as never);

    await expect(fetchDocumentTemplateLayout("test_key", fallback)).resolves.toEqual({
      template: serverTemplate,
      updatedAt: VERSION,
    });
    expect(api.fetchDocumentTemplateServer).toHaveBeenCalledWith("test_key");
  });

  it("falls back to the factory layout when the server has no row", async () => {
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue(null);

    await expect(fetchDocumentTemplateLayout("test_key", fallback)).resolves.toEqual({
      template: fallback,
      updatedAt: null,
    });
  });

  it("falls back when the stored layout is structurally invalid", async () => {
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue({
      template: { pageSize: "A6", elements: "not-an-array" },
      updatedAt: VERSION,
    } as never);

    await expect(fetchDocumentTemplateLayout("test_key", fallback)).resolves.toEqual({
      template: fallback,
      updatedAt: null,
    });
  });

  it("seeds the first paint from the cache while the server read is in flight", async () => {
    writeCachedDocumentTemplate("test_key", {
      template: { ...fallback, pageSize: "A4" },
      updatedAt: VERSION,
    });
    vi.spyOn(api, "fetchDocumentTemplateServer").mockImplementation(
      () => new Promise(() => {}) as never,
    );

    function Probe() {
      const { template, isFetching } = useDocumentTemplate<SamplePayload>("test_key", fallback);
      return (
        <span data-testid="size" data-fetching={String(isFetching)}>
          {template.pageSize}
        </span>
      );
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={createTestQueryClient()}>
          <Probe />
        </QueryClientProvider>,
      );
    });

    const node = container.querySelector('[data-testid="size"]');
    expect(node?.textContent).toBe("A4");
    expect(node?.getAttribute("data-fetching")).toBe("true");

    root.unmount();
    container.remove();
  });

  it("replaces the cached layout with the server layout and rewrites the cache", async () => {
    writeCachedDocumentTemplate("test_key", {
      template: { ...fallback, pageSize: "A4" },
      updatedAt: VERSION,
    });
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue({
      template: serverTemplate,
      updatedAt: NEXT_VERSION,
    } as never);

    function Probe() {
      const { template, updatedAt } = useDocumentTemplate<SamplePayload>("test_key", fallback);
      return (
        <span data-testid="size" data-version={updatedAt ?? ""}>
          {template.pageSize}
        </span>
      );
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={createTestQueryClient()}>
          <Probe />
        </QueryClientProvider>,
      );
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="size"]')?.textContent).toBe("A5");
    });
    expect(container.querySelector('[data-testid="size"]')?.getAttribute("data-version")).toBe(
      NEXT_VERSION,
    );
    expect(readCachedDocumentTemplate<SamplePayload>("test_key")?.template.pageSize).toBe("A5");
    expect(readCachedDocumentTemplate<SamplePayload>("test_key")?.updatedAt).toBe(NEXT_VERSION);

    root.unmount();
    container.remove();
  });

  it("sends the version the client holds and stores the new one on success", async () => {
    writeCachedDocumentTemplate("test_key", { template: fallback, updatedAt: VERSION });
    // The server keeps answering with the newest record after a save (the mutation
    // invalidates the query, so a static mock would echo the old version back).
    let current = { template: fallback, updatedAt: VERSION };
    vi.spyOn(api, "fetchDocumentTemplateServer").mockImplementation(async () => current as never);
    const saveSpy = vi
      .spyOn(api, "saveDocumentTemplateServer")
      .mockImplementation(async (_key, template) => {
        current = {
          template: template as DocumentTemplate<SamplePayload>,
          updatedAt: NEXT_VERSION,
        };
        return current as never;
      });

    let save: ((template: DocumentTemplate<SamplePayload>) => Promise<unknown>) | null = null;
    function Probe() {
      // Mount the read query too: the mutation reads the version from its cache entry.
      useDocumentTemplate<SamplePayload>("test_key", fallback);
      const mutation = useSaveDocumentTemplate<SamplePayload>("test_key");
      save = mutation.mutateAsync as unknown as typeof save;
      return <span>{mutation.isPending ? "saving" : "idle"}</span>;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const client = createTestQueryClient();

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });

    // Wait for the GET to settle so the mutation has a version to send.
    await vi.waitFor(() => {
      expect(client.getQueryData(documentTemplateQueryKey("test_key"))).toMatchObject({
        updatedAt: VERSION,
      });
    });

    await act(async () => {
      await save!(serverTemplate);
    });

    expect(saveSpy).toHaveBeenCalledWith("test_key", serverTemplate, VERSION);
    await vi.waitFor(() => {
      expect(readCachedDocumentTemplate<SamplePayload>("test_key")?.updatedAt).toBe(NEXT_VERSION);
    });
    expect(client.getQueryData(documentTemplateQueryKey("test_key"))).toMatchObject({
      updatedAt: NEXT_VERSION,
    });

    root.unmount();
    container.remove();
  });

  it("keeps the stale version and cache when the server reports a conflict", async () => {
    writeCachedDocumentTemplate("test_key", { template: fallback, updatedAt: VERSION });
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue({
      template: fallback,
      updatedAt: VERSION,
    } as never);
    const saveSpy = vi
      .spyOn(api, "saveDocumentTemplateServer")
      .mockRejectedValue(new DocumentTemplateConflictError());

    let save: ((template: DocumentTemplate<SamplePayload>) => Promise<unknown>) | null = null;
    function Probe() {
      useDocumentTemplate<SamplePayload>("test_key", fallback);
      const mutation = useSaveDocumentTemplate<SamplePayload>("test_key");
      save = mutation.mutateAsync as unknown as typeof save;
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const client = createTestQueryClient();

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });

    await vi.waitFor(() => {
      expect(client.getQueryData(documentTemplateQueryKey("test_key"))).toMatchObject({
        updatedAt: VERSION,
      });
    });

    await act(async () => {
      await expect(save!(serverTemplate)).rejects.toBeInstanceOf(DocumentTemplateConflictError);
    });

    expect(saveSpy).toHaveBeenCalledWith("test_key", serverTemplate, VERSION);
    // Still the version the client read: a retry cannot silently overwrite the other edit.
    expect(client.getQueryData(documentTemplateQueryKey("test_key"))).toMatchObject({
      updatedAt: VERSION,
    });
    expect(readCachedDocumentTemplate<SamplePayload>("test_key")?.updatedAt).toBe(VERSION);

    root.unmount();
    container.remove();
  });
});
