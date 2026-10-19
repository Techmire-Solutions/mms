import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentTemplate } from "@mms/shared";
import {
  DOCUMENT_TEMPLATES_QUERY_KEY_ROOT,
  documentTemplateQueryKey,
  documentTemplateQueryOptions,
} from "./useDocumentTemplates";
import * as api from "./documentTemplatesApi";

interface SamplePayload {
  title: string;
}

const fallback: DocumentTemplate<SamplePayload> = {
  pageSize: "A6",
  elements: [
    { id: "el-1", type: "text", label: "Title", x: 0, y: 0, w: 10, h: 10, field: "title" },
  ],
};

describe("useDocumentTemplates", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("builds consistent query key hierarchy", () => {
    const key = documentTemplateQueryKey("invoice_template");
    expect(key).toEqual([...DOCUMENT_TEMPLATES_QUERY_KEY_ROOT, "invoice_template"]);
  });

  it("queryOptions queryFn returns server template when available", async () => {
    const serverTemplate: DocumentTemplate<SamplePayload> = {
      ...fallback,
      pageSize: "A5",
    };
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue(serverTemplate as never);

    const options = documentTemplateQueryOptions<SamplePayload>("test_key", fallback);
    expect(options.queryFn).toBeDefined();
    const result = await options.queryFn!({} as never);

    expect(result).toEqual(serverTemplate);
    expect(api.fetchDocumentTemplateServer).toHaveBeenCalledWith("test_key");
  });

  it("queryOptions queryFn returns fallback when server returns null", async () => {
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue(null);

    const options = documentTemplateQueryOptions<SamplePayload>("test_key", fallback);
    expect(options.queryFn).toBeDefined();
    const result = await options.queryFn!({} as never);

    expect(result).toEqual(fallback);
  });
});
