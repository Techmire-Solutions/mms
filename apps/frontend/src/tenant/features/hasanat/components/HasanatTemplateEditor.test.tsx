import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HasanatTemplateEditor } from "./HasanatTemplateEditor";
import { saveDocumentTemplateServer } from "@/lib/templates/documentTemplatesApi";
import { notify } from "@/lib/notify";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({
    logoUrl: null,
  }),
}));

vi.mock("@/lib/db", () => ({
  getObject: (_key: string, fallback: unknown) => fallback,
  saveObject: vi.fn(),
}));

vi.mock("@/lib/templates/documentTemplatesApi", () => ({
  saveDocumentTemplateServer: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

type MockTemplate = { id: string } & Record<string, unknown>;
let capturedOnSave: ((tmpl: MockTemplate) => Promise<void>) | null = null;
vi.mock("@/components/app/TemplateEditor", () => ({
  TemplateEditor: ({ onSave }: { onSave: (tmpl: MockTemplate) => Promise<void> }) => {
    capturedOnSave = onSave;
    return <div data-testid="mock-template-editor">TemplateEditor</div>;
  },
}));

describe("HasanatTemplateEditor", () => {
  it("renders the hasanat template editor with award voucher fields", () => {
    const html = renderToStaticMarkup(<HasanatTemplateEditor onClose={vi.fn()} />);

    expect(html).toContain('data-testid="mock-template-editor"');
  });

  it("given server save error, notifies error toast and throws", async () => {
    renderToStaticMarkup(<HasanatTemplateEditor onClose={vi.fn()} />);
    expect(capturedOnSave).not.toBeNull();

    vi.mocked(saveDocumentTemplateServer).mockRejectedValueOnce(new Error("Hasanat save failed"));

    await expect(capturedOnSave!({ id: "hasanat-template" })).rejects.toThrow(
      "Hasanat save failed",
    );
    expect(notify.error).toHaveBeenCalledWith("templateEditor.saveFailed");
    expect(notify.success).not.toHaveBeenCalled();
  });

  it("given successful save, notifies success toast", async () => {
    renderToStaticMarkup(<HasanatTemplateEditor onClose={vi.fn()} />);
    expect(capturedOnSave).not.toBeNull();

    vi.mocked(saveDocumentTemplateServer).mockResolvedValueOnce({} as never);

    await capturedOnSave!({ id: "hasanat-template" });
    expect(notify.success).toHaveBeenCalledWith("hasanat.templateSaved");
  });
});
