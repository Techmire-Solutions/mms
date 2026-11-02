import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DocumentTemplate } from "@mms/shared";
import { FinanceTemplateEditor } from "./FinanceTemplateEditor";
import {
  fetchDocumentTemplateServer,
  saveDocumentTemplateServer,
} from "@/lib/templates/documentTemplatesApi";
import { notify } from "@/lib/notify";
import { withQueryClient } from "@/test/queryClientTestUtils";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({ logoUrl: null, primaryColor: "#059669", secondaryColor: "#047857" }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/templates/documentTemplatesApi", () => ({
  fetchDocumentTemplateServer: vi.fn().mockResolvedValue(null),
  saveDocumentTemplateServer: vi.fn().mockImplementation(async (_key, template) => ({
    template,
    updatedAt: "2026-01-01T00:00:00.000Z",
  })),
}));

type MockTemplate = { id: string } & Record<string, unknown>;
type CapturedEditorProps = {
  onSave: (tmpl: MockTemplate) => Promise<void>;
  availableFields?: Array<{ label: string }>;
  presets?: Array<{ label: string }>;
};
let capturedProps: CapturedEditorProps | null = null;
vi.mock("@/components/app/TemplateEditor", () => ({
  TemplateEditor: (props: CapturedEditorProps) => {
    capturedProps = props;
    return <div data-testid="mock-template-editor">TemplateEditor</div>;
  },
}));

function renderEditor(): string {
  return renderToStaticMarkup(withQueryClient(<FinanceTemplateEditor onClose={vi.fn()} />));
}

describe("FinanceTemplateEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchDocumentTemplateServer).mockResolvedValue(null);
    vi.mocked(saveDocumentTemplateServer).mockImplementation(
      async (_key, template) => template as never,
    );
  });

  it("renders the shared editor shell", () => {
    expect(renderEditor()).toContain('data-testid="mock-template-editor"');
  });

  it("localizes palette field and preset labels", () => {
    renderEditor();
    expect(capturedProps?.availableFields?.[0]?.label).toBe("finance.templateField.receiptNo");
    expect(capturedProps?.presets?.[0]?.label).toBe("finance.templatePreset.fee_receipt_typst");
  });

  it("saves through /api/templates with the finance key", async () => {
    renderEditor();
    expect(capturedProps?.onSave).not.toBeNull();
    const template = { id: "finance-template" } as unknown as DocumentTemplate;

    await capturedProps?.onSave!(template as unknown as MockTemplate);

    expect(saveDocumentTemplateServer).toHaveBeenCalledWith(
      "mms_finance_invoice_template",
      template,
      null,
    );
    expect(notify.success).toHaveBeenCalledWith("finance.templateSaved");
  });

  it("rejects without a success toast when the server save fails", async () => {
    renderEditor();
    vi.mocked(saveDocumentTemplateServer).mockRejectedValueOnce(new Error("Network disconnect"));

    await expect(
      capturedProps?.onSave!({ id: "finance-template" } as unknown as MockTemplate),
    ).rejects.toThrow("Network disconnect");
    expect(notify.success).not.toHaveBeenCalled();
  });
});
