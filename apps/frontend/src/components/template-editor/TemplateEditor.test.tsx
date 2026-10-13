import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateEditor } from "../app/TemplateEditor";
import { TemplateElementRenderer } from "./TemplateElementRenderer";
import { TemplateEditorPropertiesPanel } from "./TemplateEditorPropertiesPanel";
import { TemplateEditorExportActions } from "./TemplateEditorExportActions";
import { TemplateEditorTypographySection } from "./TemplateEditorTypographySection";
import { useTemplateEditorElementActions } from "./useTemplateEditorElementActions";
import type { DocumentTemplate, TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

const mockT = ((key: string) => key) as TranslationFunction;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({
    logoUrl: "https://example.com/logo.png",
  }),
}));

describe("TemplateEditor Component", () => {
  const sampleTemplate: DocumentTemplate = {
    pageSize: "A5",
    orientation: "portrait",
    elements: [
      { id: "el_1", type: "static", label: "Invoice Title", x: 20, y: 20, w: 200, h: 20 },
      {
        id: "el_2",
        type: "field",
        field: "studentName",
        label: "Student Name",
        x: 20,
        y: 50,
        w: 200,
        h: 20,
      },
    ],
  };

  it("renders the template editor in fullscreen mode with canvas and toolbar", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor
        title="Custom Invoice Editor"
        template={sampleTemplate}
        onClose={vi.fn()}
        availableFields={[{ field: "studentName", label: "Student Name" }]}
      />,
    );

    expect(html).toContain("Custom Invoice Editor");
    expect(html).toContain("Invoice Title");
    expect(html).toContain("templateEditor.addElements");
    expect(html).toContain("templateEditor.pageSize");
  });

  it("renders export buttons when handlers are provided", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor
        template={sampleTemplate}
        onClose={vi.fn()}
        onExportTypst={vi.fn()}
        onExportZoho={vi.fn()}
      />,
    );

    expect(html).toContain("Typst");
    expect(html).toContain("Zoho");
  });

  it("renders zoom controls, preview button, and template file export", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor template={sampleTemplate} onClose={vi.fn()} />,
    );

    expect(html).toContain("templateEditor.switchToPreview");
    // The button label is translated now; "JSON" was hardcoded English in the toolbar.
    expect(html).toContain("templateEditor.templateFile");
    expect(html).toContain("100%");
  });

  it("renders populated sample data inside field elements", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor
        template={sampleTemplate}
        sampleData={{ studentName: "Muhammad Ali" }}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("Muhammad Ali");
  });

  it("renders keyboard shortcut hints and localized footer controls", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor template={sampleTemplate} onClose={vi.fn()} />,
    );

    expect(html).toContain("templateEditor.shortcuts");
    expect(html).toContain("templateEditor.selectAll");
    expect(html).toContain("templateEditor.undo");
  });

  it("invokes onChange and onDirtyChange callbacks with template state", async () => {
    const onChange = vi.fn();
    const onDirtyChange = vi.fn();

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TemplateEditor
          template={sampleTemplate}
          onChange={onChange}
          onDirtyChange={onDirtyChange}
          onClose={vi.fn()}
        />,
      );
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: "A5",
        elements: expect.any(Array),
      }),
    );
    expect(onDirtyChange).toHaveBeenCalledWith(false);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders enhanced primitives including heading, logo, and table in element palette", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor template={sampleTemplate} onClose={vi.fn()} />,
    );

    expect(html).toContain("templateEditor.heading");
    expect(html).toContain("templateEditor.staticText");
    expect(html).toContain("templateEditor.divider");
    expect(html).toContain("templateEditor.qrCode");
    expect(html).toContain("templateEditor.logo");
    expect(html).toContain("templateEditor.table");
  });

  it("renders printable safe margins guide when guides are active", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor template={sampleTemplate} onClose={vi.fn()} />,
    );

    expect(html).toContain("templateEditor.safeMargins");
  });

  it("renders copy, paste, space-pan, and alt-resize hints in the footer shortcuts list", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor template={sampleTemplate} onClose={vi.fn()} />,
    );

    // Copy/cut and paste are separate entries now, and the cut shortcut (which the
    // shortcut layer has always implemented) is finally advertised.
    expect(html).toContain("templateEditor.copy / templateEditor.cut");
    expect(html).toContain("templateEditor.paste");
    expect(html).toContain("templateEditor.spaceToPan");
    expect(html).toContain("templateEditor.altResize");
  });

  it("renders browser print / PDF export action in toolbar", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor template={sampleTemplate} onClose={vi.fn()} />,
    );

    expect(html).toContain("templateEditor.print");
  });

  it("names the dialog through the visible heading, not a concatenated string", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor
        template={sampleTemplate}
        documentType="receipt"
        fullscreen={true}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('tabindex="-1"');

    // The dialog is labelled by the heading the user can see. The label used to be
    // built by string concatenation (`"Receipt Template Editor"`) in English only.
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toContain(`id="${labelledBy}"`);
    expect(html).toContain("templateEditor.documentTitle");
  });

  it("exposes labelled control groups instead of a half-implemented toolbar role", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor template={sampleTemplate} onClose={vi.fn()} />,
    );

    /*
     * `role="toolbar"` promised the WAI-ARIA toolbar pattern (one tab stop, arrow-key
     * navigation) while offering ~15 independent tab stops and a `<select>` in the
     * middle. The groups are individually labelled instead, and a test now pins that
     * decision so it cannot be half-reverted.
     */
    expect(html).not.toContain('role="toolbar"');
    expect(html).toContain('aria-label="templateEditor.history"');
    expect(html).toContain('aria-label="templateEditor.viewOptions"');
    expect(html).toContain('aria-label="templateEditor.documentActions"');
    expect(html).toContain('aria-label="templateEditor.toggleGuides"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("makes exactly one canvas element a tab stop (roving tabindex)", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor template={sampleTemplate} onClose={vi.fn()} />,
    );

    // With 20+ absolutely positioned elements, one tab stop per element put the
    // inspector dozens of tabs away from the canvas.
    expect(html).toMatch(/tabindex="0"[^>]*aria-label="Invoice Title \(static\)"/);
    expect(html).toMatch(/tabindex="-1"[^>]*aria-label="Student Name \(field\)"/);
  });

  it("labels the page size in pixels, the unit the editor actually stores", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor template={sampleTemplate} onClose={vi.fn()} />,
    );

    // PAGE_SIZES are CSS pixels at 96dpi; the status pill used to claim "pt".
    expect(html).toContain("559 × 794 px");
    expect(html).not.toContain("559 × 794 pt");
  });

  it("makes the scrollable canvas region keyboard focusable", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor template={sampleTemplate} onClose={vi.fn()} />,
    );

    expect(html).toContain('aria-label="templateEditor.canvasViewport"');
    expect(html).toMatch(/tabindex="0"[^>]*aria-label="templateEditor\.canvasViewport"/);
  });

  it("renders role='region' without aria-modal when fullscreen is false", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor template={sampleTemplate} fullscreen={false} onClose={vi.fn()} />,
    );

    expect(html).toContain('role="region"');
    expect(html).not.toContain('aria-modal="true"');
  });
});

describe("TemplateElementRenderer Component", () => {
  it("renders all 8 directional resize handles and aria-live dimension badge when element is selected", () => {
    const html = renderToStaticMarkup(
      <TemplateElementRenderer
        el={{ id: "el_1", type: "static", label: "Invoice Title", x: 20, y: 20, w: 200, h: 20 }}
        isSelected={true}
        isPreviewMode={false}
        branding={{ logoUrl: null }}
        onMouseDownElement={vi.fn()}
        onMouseDownResize={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    // 8-point handles
    expect(html).toContain("cursor-ns-resize");
    expect(html).toContain("cursor-ew-resize");
    expect(html).toContain("cursor-nwse-resize");
    expect(html).toContain("cursor-nesw-resize");
    expect(html).toContain("cursor-se-resize");

    // Dimension badge with aria-live="off" (prevents screen-reader announcement floods during drag)
    expect(html).toContain('aria-live="off"');
    expect(html).toContain("200 × 20");
  });

  it("does not render resize handles when isPreviewMode is true even if selected", () => {
    const html = renderToStaticMarkup(
      <TemplateElementRenderer
        el={{ id: "el_1", type: "static", label: "Invoice Title", x: 20, y: 20, w: 200, h: 20 }}
        isSelected={true}
        isPreviewMode={true}
        branding={{ logoUrl: null }}
        onMouseDownElement={vi.fn()}
        onMouseDownResize={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).not.toContain("cursor-se-resize");
    expect(html).not.toContain("cursor-ew-resize");
    expect(html).not.toContain("cursor-ns-resize");
    expect(html).not.toContain("cursor-nwse-resize");
  });

  it("applies textDecoration underline and custom border styling", () => {
    const html = renderToStaticMarkup(
      <TemplateElementRenderer
        el={{
          id: "el_1",
          type: "static",
          label: "Underlined Title",
          x: 20,
          y: 20,
          w: 200,
          h: 20,
          style: {
            textDecoration: "underline",
            borderWidth: 2,
            borderColor: "#3b82f6",
            borderRadius: 4,
          },
        }}
        isSelected={false}
        isPreviewMode={false}
        branding={{ logoUrl: null }}
        onMouseDownElement={vi.fn()}
        onMouseDownResize={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain("text-decoration:underline");
    expect(html).toContain("border:2px solid #3b82f6");
    expect(html).toContain("border-radius:4px");
  });

  it("renders table element with columns and mock line items", () => {
    const html = renderToStaticMarkup(
      <TemplateElementRenderer
        el={{
          id: "el_table",
          type: "table",
          label: "Items Table",
          x: 20,
          y: 80,
          w: 300,
          h: 120,
          columns: [
            { id: "c1", header: "Description", field: "description", align: "left" },
            { id: "c2", header: "Amount", field: "amount", align: "right" },
          ],
          tableConfig: {
            showHeader: true,
            zebra: true,
            headerBackground: "#f1f5f9",
          },
        }}
        isSelected={false}
        isPreviewMode={false}
        branding={{ logoUrl: null }}
        onMouseDownElement={vi.fn()}
        onMouseDownResize={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain("Items Table (table)");
    expect(html).toContain("Description");
    expect(html).toContain("Amount");
    expect(html).toContain("Tuition / Fee Item 1");
  });

  it("auto-detects Arabic / Urdu script and sets direction rtl and text-align right", () => {
    const html = renderToStaticMarkup(
      <TemplateElementRenderer
        el={{
          id: "el_ar",
          type: "static",
          label: "فاتورة رسوم الطالب",
          x: 20,
          y: 20,
          w: 200,
          h: 30,
        }}
        isSelected={false}
        isPreviewMode={false}
        branding={{ logoUrl: null }}
        onMouseDownElement={vi.fn()}
        onMouseDownResize={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain('dir="rtl"');
    expect(html).toContain("text-align:right");
  });

  it("interpolates mustache tokens in static text with sample data", () => {
    const html = renderToStaticMarkup(
      <TemplateElementRenderer
        el={{
          id: "el_tok",
          type: "static",
          label: "Invoice for {{studentName}} (ID: {{studentId}})",
          x: 20,
          y: 20,
          w: 250,
          h: 30,
        }}
        isSelected={false}
        isPreviewMode={false}
        sampleData={{ studentName: "Ali Raza", studentId: "STD-99" }}
        branding={{ logoUrl: null }}
        onMouseDownElement={vi.fn()}
        onMouseDownResize={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain("Invoice for Ali Raza (ID: STD-99)");
  });
});

describe("TemplateEditorPropertiesPanel Component", () => {
  it("renders appearance section with background, border width, and corner radius inputs", () => {
    const html = renderToStaticMarkup(
      <TemplateEditorPropertiesPanel
        selectedElement={{
          id: "el_1",
          type: "static",
          label: "Card Title",
          x: 20,
          y: 20,
          w: 200,
          h: 40,
          style: {
            backgroundColor: "#f8fafc",
            borderWidth: 1,
            borderRadius: 8,
          },
        }}
        onPatchElement={vi.fn()}
        onPatchStyle={vi.fn()}
        onDuplicateElement={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain("templateEditor.appearance");
    expect(html).toContain("templateEditor.backgroundColor");
    expect(html).toContain("templateEditor.borderWidth");
    expect(html).toContain("templateEditor.borderRadius");
    expect(html).toContain("templateEditor.transparent");
  });

  it("renders table configuration section when a table element is selected", () => {
    const html = renderToStaticMarkup(
      <TemplateEditorPropertiesPanel
        selectedElement={{
          id: "el_tbl",
          type: "table",
          label: "Itemized List",
          x: 20,
          y: 20,
          w: 300,
          h: 120,
          columns: [{ id: "c1", header: "Item", field: "item", width: 70, align: "left" }],
        }}
        onPatchElement={vi.fn()}
        onPatchStyle={vi.fn()}
        onDuplicateElement={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain("templateEditor.table");
    expect(html).toContain("templateEditor.addColumn");
    expect(html).toContain("templateEditor.columnHeader");
  });

  it("renders batch appearance controls when multiple elements are selected", () => {
    const html = renderToStaticMarkup(
      <TemplateEditorPropertiesPanel
        selectedElement={{ id: "el_1", type: "static", label: "A", x: 10, y: 10, w: 50, h: 20 }}
        selectedElements={[
          { id: "el_1", type: "static", label: "A", x: 10, y: 10, w: 50, h: 20 },
          { id: "el_2", type: "static", label: "B", x: 20, y: 20, w: 50, h: 20 },
        ]}
        onPatchElement={vi.fn()}
        onPatchStyle={vi.fn()}
        onPatchSelectedStyles={vi.fn()}
        onDuplicateElement={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain("templateEditor.typography");
    expect(html).toContain("templateEditor.appearance");
    expect(html).toContain("templateEditor.color");
    expect(html).toContain("templateEditor.fontSize");
  });

  it("offers the layer list when nothing is selected, so covered elements are reachable", () => {
    const elements = [
      { id: "el_divider", type: "divider" as const, label: "", x: 0, y: 40, w: 300, h: 1 },
      { id: "el_logo", type: "logo" as const, label: "Logo", x: 10, y: 10, w: 60, h: 60 },
    ];
    const html = renderToStaticMarkup(
      <TemplateEditorPropertiesPanel
        selectedElement={undefined}
        elements={elements}
        onSelectElement={vi.fn()}
        onPatchElement={vi.fn()}
        onPatchStyle={vi.fn()}
        onDuplicateElement={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain("templateEditor.layerList");
    // 1px dividers cannot be hit with a pointer; the list is their selection path.
    expect(html).toContain("divider ·");
  });

  it("lets an existing field element be re-bound to another data field", () => {
    const html = renderToStaticMarkup(
      <TemplateEditorPropertiesPanel
        selectedElement={{
          id: "el_field",
          type: "field",
          label: "Receipt No",
          field: "receipt_no",
          x: 10,
          y: 10,
          w: 120,
          h: 16,
        }}
        availableFields={[
          { field: "receipt_no", label: "Receipt No" },
          { field: "amount", label: "Amount" },
        ]}
        onPatchElement={vi.fn()}
        onPatchStyle={vi.fn()}
        onDuplicateElement={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain("templateEditor.dataField");
    expect(html).toContain("templateEditor.labelFieldHint");
    expect(html).toContain("Amount");
  });

  it("explains that a static element's label is the printed text", () => {
    const html = renderToStaticMarkup(
      <TemplateEditorPropertiesPanel
        selectedElement={{ id: "el_1", type: "static", label: "Title", x: 10, y: 10, w: 50, h: 20 }}
        onPatchElement={vi.fn()}
        onPatchStyle={vi.fn()}
        onDuplicateElement={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain("templateEditor.labelStaticHint");
  });

  it("renders empty hint when no element is selected", () => {
    const html = renderToStaticMarkup(
      <TemplateEditorPropertiesPanel
        selectedElement={undefined}
        onPatchElement={vi.fn()}
        onPatchStyle={vi.fn()}
        onDuplicateElement={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain("templateEditor.emptyHint");
    expect(html).toContain("templateEditor.emptyHintDetail");
  });

  it("renders multi-select panel with dimensions badge, snap-to-edge, and appearance controls", () => {
    const html = renderToStaticMarkup(
      <TemplateEditorPropertiesPanel
        selectedElements={[
          { id: "el_1", type: "static", label: "A", x: 10, y: 10, w: 100, h: 30 },
          { id: "el_2", type: "static", label: "B", x: 20, y: 50, w: 120, h: 40 },
        ]}
        selectedElement={undefined}
        onDuplicateElement={vi.fn()}
        onDeleteElement={vi.fn()}
        onPatchElement={vi.fn()}
        onPatchStyle={vi.fn()}
        onPatchSelectedStyles={vi.fn()}
        onSnapSelected={vi.fn()}
        t={mockT}
      />,
    );

    // Bounding box from (10,10) to (140, 90) => 130 × 80 px
    expect(html).toContain("130 × 80 px");
    expect(html).toContain("templateEditor.borderColor");
    expect(html).toContain("templateEditor.borderWidth");
    expect(html).toContain('aria-label="templateEditor.snapTop"');
    expect(html).toContain('aria-label="templateEditor.snapRight"');
  });

  describe("TemplateEditorExportActions", () => {
    it("renders export group with accessible role, labels, and print isolation", () => {
      const html = renderToStaticMarkup(
        <TemplateEditorExportActions
          onExportJson={vi.fn()}
          onImportJson={vi.fn()}
          onExportTypst={vi.fn()}
          onExportZoho={vi.fn()}
          onPrint={vi.fn()}
          t={mockT}
        />,
      );

      expect(html).toContain('role="group"');
      // The group holds Print and Import too, so labelling it "Export" was wrong.
      expect(html).toContain('aria-label="templateEditor.exportImport"');
      expect(html).toContain("print:hidden");
      expect(html).toContain('aria-label="templateEditor.print"');
      expect(html).toContain('aria-label="templateEditor.exportJson"');
      expect(html).toContain('aria-label="templateEditor.importJson"');
      expect(html).toContain('aria-label="templateEditor.exportTypst"');
      expect(html).toContain('aria-label="templateEditor.exportZoho"');
      expect(html).toContain('accept=".json,application/json"');
    });

    it("disables actions and renders spinner when isExporting is true", () => {
      const html = renderToStaticMarkup(
        <TemplateEditorExportActions
          onExportJson={vi.fn()}
          onImportJson={vi.fn()}
          onExportTypst={vi.fn()}
          onExportZoho={vi.fn()}
          onPrint={vi.fn()}
          isExporting={true}
          t={mockT}
        />,
      );

      expect(html).toContain("disabled");
      expect(html).toContain("animate-spin");
    });
  });

  describe("TemplateEditorTypographySection", () => {
    it("renders font size decrement and increment stepper buttons", () => {
      const html = renderToStaticMarkup(
        <TemplateEditorTypographySection
          elementId="el_1"
          elStyle={{ fontSize: 14 }}
          isOpen={true}
          onToggle={vi.fn()}
          onPatchStyle={vi.fn()}
          t={mockT}
        />,
      );

      expect(html).toContain('aria-label="templateEditor.decreaseFontSize"');
      expect(html).toContain('aria-label="templateEditor.increaseFontSize"');
      expect(html).toContain('value="14"');
    });

    it("evaluates allBold across multiple selected elements", () => {
      const mixedElements: TemplateElement[] = [
        {
          id: "el_1",
          type: "static",
          label: "A",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          style: { fontWeight: "bold" },
        },
        {
          id: "el_2",
          type: "static",
          label: "B",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          style: { fontWeight: "normal" },
        },
      ];

      const html = renderToStaticMarkup(
        <TemplateEditorTypographySection
          elStyle={{ fontWeight: "bold" }}
          selectedElements={mixedElements}
          isOpen={true}
          onToggle={vi.fn()}
          onPatchStyle={vi.fn()}
          t={mockT}
        />,
      );

      // In mixed state, allBold is false, so aria-pressed should be false
      expect(html).toContain('aria-label="templateEditor.bold"');
      expect(html).toContain('aria-pressed="false"');
    });

    it("renders indeterminate state on RTL checkbox when direction is mixed across elements", () => {
      const mixedElements: TemplateElement[] = [
        {
          id: "el_1",
          type: "static",
          label: "A",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          style: { direction: "rtl" },
        },
        {
          id: "el_2",
          type: "static",
          label: "B",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          style: { direction: "ltr" },
        },
      ];

      const html = renderToStaticMarkup(
        <TemplateEditorTypographySection
          elStyle={{ direction: "rtl" }}
          selectedElements={mixedElements}
          isOpen={true}
          onToggle={vi.fn()}
          onPatchStyle={vi.fn()}
          t={mockT}
        />,
      );

      expect(html).toContain('data-state="indeterminate"');
    });

    it("evaluates mixed alignment and mixed colors across multiple selected elements", () => {
      const mixedElements: TemplateElement[] = [
        {
          id: "el_1",
          type: "static",
          label: "A",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          style: { textAlign: "left", color: "#10b981" },
        },
        {
          id: "el_2",
          type: "static",
          label: "B",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          style: { textAlign: "center", color: "#ef4444" },
        },
      ];

      const html = renderToStaticMarkup(
        <TemplateEditorTypographySection
          elStyle={{ textAlign: "left", color: "#10b981" }}
          selectedElements={mixedElements}
          isOpen={true}
          onToggle={vi.fn()}
          onPatchStyle={vi.fn()}
          t={mockT}
        />,
      );

      // In mixed alignment, start alignment is not active across all elements
      expect(html).toContain('aria-label="templateEditor.alignStart"');
      expect(html).toContain('aria-label="templateEditor.alignCenter"');

      // In mixed color, the first element's swatch is not falsely selected with ring
      expect(html).not.toContain("ring-2 ring-primary ring-offset-2");
    });
  });

  describe("useTemplateEditorElementActions", () => {
    it("snaps right and bottom edges to the 4mm grid", async () => {
      let actions!: ReturnType<typeof useTemplateEditorElementActions>;
      let currentElements: TemplateElement[] = [
        { id: "el_1", type: "static", label: "A", x: 10, y: 10, w: 65, h: 45 },
      ];
      const commitUpdate = vi.fn((fn: (els: TemplateElement[]) => TemplateElement[]) => {
        currentElements = fn(currentElements);
      });

      function Harness() {
        actions = useTemplateEditorElementActions<Record<string, unknown>>({
          elements: currentElements,
          selectedIds: ["el_1"],
          setSelectedIds: vi.fn(),
          commitUpdate,
          commitUpdateCoalesced: vi.fn(),
          size: { width: 210, height: 297, label: "A4" },
          t: mockT,
        });
        return null;
      }

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(<Harness />);
      });

      // Snap to right edge: size.width - el.w = 210 - 65 = 145 -> snap(145) = 144
      act(() => {
        actions.snapSelected("right");
      });
      expect(currentElements[0].x).toBe(144);

      // Snap to bottom edge: size.height - el.h = 297 - 45 = 252 -> snap(252) = 252
      act(() => {
        actions.snapSelected("bottom");
      });
      expect(currentElements[0].y).toBe(252);

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it("equalizes dimensions across selected elements", async () => {
      let actions!: ReturnType<typeof useTemplateEditorElementActions>;
      let currentElements: TemplateElement[] = [
        { id: "el_1", type: "static", label: "A", x: 10, y: 10, w: 100, h: 50 },
        { id: "el_2", type: "static", label: "B", x: 20, y: 80, w: 60, h: 30 },
      ];
      const commitUpdate = vi.fn((fn: (els: TemplateElement[]) => TemplateElement[]) => {
        currentElements = fn(currentElements);
      });

      function Harness() {
        actions = useTemplateEditorElementActions<Record<string, unknown>>({
          elements: currentElements,
          selectedIds: ["el_1", "el_2"],
          setSelectedIds: vi.fn(),
          commitUpdate,
          commitUpdateCoalesced: vi.fn(),
          size: { width: 210, height: 297, label: "A4" },
          t: mockT,
        });
        return null;
      }

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(<Harness />);
      });

      act(() => {
        actions.equalizeSelectedDimensions("width");
      });
      expect(currentElements[1].w).toBe(100);
      expect(currentElements[1].h).toBe(30);

      act(() => {
        actions.equalizeSelectedDimensions("both");
      });
      expect(currentElements[1].w).toBe(100);
      expect(currentElements[1].h).toBe(50);

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it("creates table with unique column IDs in addTable", async () => {
      let actions!: ReturnType<typeof useTemplateEditorElementActions>;
      let currentElements: TemplateElement[] = [];
      const commitUpdate = vi.fn((fn: (els: TemplateElement[]) => TemplateElement[]) => {
        currentElements = fn(currentElements);
      });

      function Harness() {
        actions = useTemplateEditorElementActions<Record<string, unknown>>({
          elements: currentElements,
          selectedIds: [],
          setSelectedIds: vi.fn(),
          commitUpdate,
          commitUpdateCoalesced: vi.fn(),
          size: { width: 210, height: 297, label: "A4" },
          t: mockT,
        });
        return null;
      }

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(<Harness />);
      });

      act(() => {
        actions.addTable();
      });
      const tableEl = currentElements[0];
      expect(tableEl.type).toBe("table");
      expect(tableEl.columns).toBeDefined();
      expect(tableEl.columns?.length).toBe(3);
      tableEl.columns?.forEach((col) => {
        expect(col.id).toBeDefined();
        expect(typeof col.id).toBe("string");
        expect(col.id?.length).toBeGreaterThan(0);
      });

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it("maintains stable action handler references across renders when state is unchanged", async () => {
      const capturedActions: ReturnType<typeof useTemplateEditorElementActions>[] = [];
      const currentElements: TemplateElement[] = [
        { id: "el_1", type: "static", label: "A", x: 10, y: 10, w: 100, h: 50 },
      ];
      const selectedIds = ["el_1"];
      const setSelectedIds = vi.fn();
      const commitUpdate = vi.fn();
      const commitUpdateCoalesced = vi.fn();
      const size = { width: 210, height: 297, label: "A4" };

      function Harness({ count }: { count: number }) {
        const actions = useTemplateEditorElementActions<Record<string, unknown>>({
          elements: currentElements,
          selectedIds,
          setSelectedIds,
          commitUpdate,
          commitUpdateCoalesced,
          size,
          t: mockT,
        });
        capturedActions.push(actions);
        return <div>{count}</div>;
      }

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(<Harness count={1} />);
      });
      await act(async () => {
        root.render(<Harness count={2} />);
      });

      expect(capturedActions.length).toBe(2);
      expect(capturedActions[0].selectElement).toBe(capturedActions[1].selectElement);
      expect(capturedActions[0].deleteElement).toBe(capturedActions[1].deleteElement);
      expect(capturedActions[0].snapSelected).toBe(capturedActions[1].snapSelected);
      expect(capturedActions[0].addStaticText).toBe(capturedActions[1].addStaticText);
      expect(capturedActions[0].equalizeSelectedDimensions).toBe(
        capturedActions[1].equalizeSelectedDimensions,
      );

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it("regenerates unique column IDs when duplicating a table element", async () => {
      let actions!: ReturnType<typeof useTemplateEditorElementActions>;
      let currentElements: TemplateElement[] = [
        {
          id: "table_1",
          type: "table",
          label: "Table",
          x: 20,
          y: 20,
          w: 300,
          h: 120,
          columns: [
            { id: "col_1", header: "Item", field: "id", width: 100, align: "left" },
            { id: "col_2", header: "Price", field: "amount", width: 100, align: "right" },
          ],
        },
      ];
      const commitUpdate = vi.fn((fn: (els: TemplateElement[]) => TemplateElement[]) => {
        currentElements = fn(currentElements);
      });

      function Harness() {
        actions = useTemplateEditorElementActions<Record<string, unknown>>({
          elements: currentElements,
          selectedIds: ["table_1"],
          setSelectedIds: vi.fn(),
          commitUpdate,
          commitUpdateCoalesced: vi.fn(),
          size: { width: 210, height: 297, label: "A4" },
          t: mockT,
        });
        return null;
      }

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(<Harness />);
      });

      act(() => {
        actions.duplicateElement("table_1");
      });

      expect(currentElements.length).toBe(2);
      const duplicated = currentElements[1];
      expect(duplicated.type).toBe("table");
      expect(duplicated.id).not.toBe("table_1");
      expect(duplicated.columns).toBeDefined();
      expect(duplicated.columns?.length).toBe(2);
      expect(duplicated.columns?.[0].id).not.toBe("col_1");
      expect(duplicated.columns?.[1].id).not.toBe("col_2");

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it("does not trigger history update for align or distribute when fewer than 2 items are selected", async () => {
      let actions!: ReturnType<typeof useTemplateEditorElementActions>;
      const currentElements: TemplateElement[] = [
        { id: "el_1", type: "static", label: "A", x: 10, y: 10, w: 100, h: 50 },
      ];
      const commitUpdate = vi.fn();

      function Harness() {
        actions = useTemplateEditorElementActions<Record<string, unknown>>({
          elements: currentElements,
          selectedIds: ["el_1"],
          setSelectedIds: vi.fn(),
          commitUpdate,
          commitUpdateCoalesced: vi.fn(),
          size: { width: 210, height: 297, label: "A4" },
          t: mockT,
        });
        return null;
      }

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(<Harness />);
      });

      act(() => {
        actions.alignSelected("left");
        actions.distributeSelected("horizontal");
      });

      expect(commitUpdate).not.toHaveBeenCalled();

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });
  });
});
