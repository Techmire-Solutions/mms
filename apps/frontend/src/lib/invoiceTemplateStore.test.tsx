import React, { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  getDefaultTemplate,
  getPageDimensions,
  PAGE_SIZES,
  AVAILABLE_FIELDS,
  resolveField,
  getAvailablePresets,
  getInvoiceTemplateBranding,
  generateQrSvgUri,
  generateQrMatrix,
  useInvoiceTemplate,
  INVOICE_TEMPLATE_KEY,
} from "./invoiceTemplateStore";
import * as api from "./templates/documentTemplatesApi";
import { createTestQueryClient } from "@/test/queryClientTestUtils";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("invoice template facade", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(api, "fetchDocumentTemplateServer").mockResolvedValue(null);
    vi.spyOn(api, "saveDocumentTemplateServer").mockImplementation(
      async (_key, template) => template as never,
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("exports the template primitives and utilities", () => {
    expect(typeof getDefaultTemplate).toBe("function");
    expect(typeof getPageDimensions).toBe("function");
    expect(PAGE_SIZES).toBeDefined();
    expect(Array.isArray(AVAILABLE_FIELDS)).toBe(true);
    expect(typeof resolveField).toBe("function");
    expect(getAvailablePresets().length).toBeGreaterThan(0);
    expect(typeof getInvoiceTemplateBranding).toBe("function");
    expect(typeof generateQrSvgUri).toBe("function");
    expect(typeof generateQrMatrix).toBe("function");
    expect(INVOICE_TEMPLATE_KEY).toBe("mms_invoice_template");
  });

  it("renders the factory layout for a tenant without a stored layout", async () => {
    let state: ReturnType<typeof useInvoiceTemplate> | null = null;
    function Probe() {
      state = useInvoiceTemplate();
      return <span data-testid="size">{state.template.pageSize}</span>;
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

    expect(container.querySelector('[data-testid="size"]')?.textContent).toBe("A6");
    expect(state!.template.elements.length).toBeGreaterThan(0);

    root.unmount();
    container.remove();
  });

  it("saves the applied preset through /api/templates", async () => {
    let state: ReturnType<typeof useInvoiceTemplate> | null = null;
    function Probe() {
      state = useInvoiceTemplate();
      return <span data-testid="size">{state.template.pageSize}</span>;
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

    const preset = getAvailablePresets()[0]!;
    await act(async () => {
      const applied = state!.applyPreset(preset.key);
      expect(applied?.pageSize).toBe(preset.template.pageSize);
    });

    expect(api.saveDocumentTemplateServer).toHaveBeenCalledWith(
      INVOICE_TEMPLATE_KEY,
      preset.template,
    );

    root.unmount();
    container.remove();
  });
});
