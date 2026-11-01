import React, { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import type { DocumentTemplate } from "@mms/shared";
import {
  DOCUMENT_TEMPLATES_QUERY_KEY_ROOT,
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

  it("returns the server layout when it is valid", async () => {
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue(serverTemplate as never);

    await expect(fetchDocumentTemplateLayout("test_key", fallback)).resolves.toEqual(
      serverTemplate,
    );
    expect(api.fetchDocumentTemplateServer).toHaveBeenCalledWith("test_key");
  });

  it("falls back when the server has no layout", async () => {
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue(null);

    await expect(fetchDocumentTemplateLayout("test_key", fallback)).resolves.toEqual(fallback);
  });

  it("falls back when the stored layout is structurally invalid", async () => {
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue({
      pageSize: "A6",
      elements: "not-an-array",
    } as never);

    await expect(fetchDocumentTemplateLayout("test_key", fallback)).resolves.toEqual(fallback);
  });

  it("seeds the first paint from the cache while the server read is in flight", async () => {
    writeCachedDocumentTemplate("test_key", { ...fallback, pageSize: "A4" });
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
    writeCachedDocumentTemplate("test_key", { ...fallback, pageSize: "A4" });
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue(serverTemplate as never);

    function Probe() {
      const { template } = useDocumentTemplate<SamplePayload>("test_key", fallback);
      return <span data-testid="size">{template.pageSize}</span>;
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
    expect(readCachedDocumentTemplate<SamplePayload>("test_key")?.pageSize).toBe("A5");

    root.unmount();
    container.remove();
  });

  it("persists a saved layout into the cache and the query cache", async () => {
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue(null);
    const saveSpy = vi
      .spyOn(api, "saveDocumentTemplateServer")
      .mockImplementation(async (_key, template) => template as never);

    let save: ((template: DocumentTemplate<SamplePayload>) => Promise<unknown>) | null = null;
    function Probe() {
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

    await act(async () => {
      await save!(serverTemplate);
    });

    expect(saveSpy).toHaveBeenCalledWith("test_key", serverTemplate);
    expect(readCachedDocumentTemplate<SamplePayload>("test_key")?.pageSize).toBe("A5");
    expect(client.getQueryData(documentTemplateQueryKey("test_key"))).toEqual(serverTemplate);

    root.unmount();
    container.remove();
  });
});
