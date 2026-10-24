import React, { act } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { createRoot } from "react-dom/client";
import {
  getDefaultTemplate,
  getPageDimensions,
  PAGE_SIZES,
  AVAILABLE_FIELDS,
  resolveField,
  loadTemplate,
  saveTemplate,
  resetTemplate,
  getAvailablePresets,
  getInvoiceTemplateBranding,
  generateQrSvgUri,
  generateQrMatrix,
  INVOICE_TEMPLATE_CHANGED_EVENT,
  useInvoiceTemplate,
  type InvoiceTemplate,
} from "./invoiceTemplateStore";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("invoiceTemplateStore facade", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("exports all required domain primitives and utilities", () => {
    expect(typeof getDefaultTemplate).toBe("function");
    expect(typeof getPageDimensions).toBe("function");
    expect(PAGE_SIZES).toBeDefined();
    expect(Array.isArray(AVAILABLE_FIELDS)).toBe(true);
    expect(typeof resolveField).toBe("function");
    expect(typeof loadTemplate).toBe("function");
    expect(typeof saveTemplate).toBe("function");
    expect(typeof resetTemplate).toBe("function");
    expect(typeof getAvailablePresets).toBe("function");
    expect(typeof getInvoiceTemplateBranding).toBe("function");
    expect(typeof generateQrSvgUri).toBe("function");
    expect(typeof generateQrMatrix).toBe("function");
    expect(INVOICE_TEMPLATE_CHANGED_EVENT).toBe("mms:invoice-template-changed");
    expect(typeof useInvoiceTemplate).toBe("function");
  });

  it("provides reactive useInvoiceTemplate hook that synchronizes updates", async () => {
    let currentHookState: ReturnType<typeof useInvoiceTemplate> | null = null;

    function TestComponent() {
      const state = useInvoiceTemplate();
      currentHookState = state;
      return (
        <div data-testid="template-view">
          <span data-testid="page-size">{state.template.pageSize}</span>
          <span data-testid="element-count">{state.template.elements.length}</span>
        </div>
      );
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(currentHookState).not.toBeNull();
    expect(container.querySelector('[data-testid="page-size"]')?.textContent).toBe("A6");

    // Mutate via hook saveTemplate
    await act(async () => {
      currentHookState!.saveTemplate({
        ...currentHookState!.template,
        pageSize: "A5",
        elements: [],
      });
    });

    expect(container.querySelector('[data-testid="page-size"]')?.textContent).toBe("A5");
    expect(container.querySelector('[data-testid="element-count"]')?.textContent).toBe("0");

    // Reset back to defaults
    await act(async () => {
      currentHookState!.resetTemplate();
    });

    expect(container.querySelector('[data-testid="page-size"]')?.textContent).toBe("A6");
    expect(
      Number(container.querySelector('[data-testid="element-count"]')?.textContent),
    ).toBeGreaterThan(0);

    root.unmount();
    container.remove();
  });

  it("updates useInvoiceTemplate when external storage or custom event is dispatched", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function TestComponent() {
      const { template } = useInvoiceTemplate();
      return <div data-testid="title">{template.orientation ?? "portrait"}</div>;
    }

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(container.querySelector('[data-testid="title"]')?.textContent).toBe("portrait");

    // Simulate external save from another component
    const updated: InvoiceTemplate = {
      ...loadTemplate(),
      orientation: "landscape",
    };

    await act(async () => {
      saveTemplate(updated);
    });

    expect(container.querySelector('[data-testid="title"]')?.textContent).toBe("landscape");

    root.unmount();
    container.remove();
  });

  it("applies presets and updates hook state", async () => {
    let currentHookState: ReturnType<typeof useInvoiceTemplate> | null = null;

    function TestComponent() {
      const state = useInvoiceTemplate();
      currentHookState = state;
      return <div data-testid="preset-test">{state.template.pageSize}</div>;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    const presets = getAvailablePresets();
    expect(presets.length).toBeGreaterThan(0);
    const firstPreset = presets[0]!;

    await act(async () => {
      const applied = currentHookState!.applyPreset(firstPreset.key);
      expect(applied).not.toBeNull();
      expect(applied?.pageSize).toBe(firstPreset.template.pageSize);
    });

    expect(container.querySelector('[data-testid="preset-test"]')?.textContent).toBe(
      firstPreset.template.pageSize,
    );

    // Applying non-existent preset returns null
    await act(async () => {
      const nonExistent = currentHookState!.applyPreset("non-existent-preset-key-xyz");
      expect(nonExistent).toBeNull();
    });

    root.unmount();
    container.remove();
  });
});
