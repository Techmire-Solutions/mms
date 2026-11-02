import React, { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { DocumentTemplate } from "@mms/shared";
import { DocumentTemplateEditor } from "./DocumentTemplateEditor";
import {
  fetchDocumentTemplateServer,
  saveDocumentTemplateServer,
} from "@/lib/templates/documentTemplatesApi";
import { notify } from "@/lib/notify";
import { withQueryClient } from "@/test/queryClientTestUtils";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/templates/documentTemplatesApi", () => ({
  fetchDocumentTemplateServer: vi.fn().mockResolvedValue(null),
  saveDocumentTemplateServer: vi.fn().mockImplementation(async (_key, template) => ({
    template,
    updatedAt: "2026-01-01T00:00:00.000Z",
  })),
  deleteDocumentTemplateServer: vi.fn().mockResolvedValue(true),
}));

type EditorProps = {
  template: DocumentTemplate;
  canSave?: boolean;
  topBanner?: React.ReactNode;
  onSave: (template: DocumentTemplate) => Promise<void>;
};
let captured: EditorProps | null = null;
vi.mock("@/components/app/TemplateEditor", () => ({
  TemplateEditor: (props: EditorProps) => {
    captured = props;
    return (
      <div data-testid="mock-editor" data-can-save={String(props.canSave)}>
        {props.topBanner}
        {props.template.elements[0]?.label}
      </div>
    );
  },
}));

const VERSION = "2026-01-01T00:00:00.000Z";

const serverTemplate: DocumentTemplate = {
  pageSize: "A6",
  elements: [{ id: "e1", type: "static", label: "SERVER", x: 0, y: 0, w: 100, h: 20 }],
};
const latestTemplate: DocumentTemplate = {
  pageSize: "A6",
  elements: [{ id: "e1", type: "static", label: "LATEST", x: 0, y: 0, w: 100, h: 20 }],
};

const conflictError = Object.assign(new Error("conflict"), {
  name: "DocumentTemplateConflictError",
});

async function renderEditor(): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      withQueryClient(
        <DocumentTemplateEditor
          templateKey="test_key"
          defaultTemplate={serverTemplate}
          savedMessage="saved"
          onClose={() => {}}
        />,
      ),
    );
  });
  return container;
}

describe("DocumentTemplateEditor conflict handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured = null;
    vi.mocked(fetchDocumentTemplateServer).mockResolvedValue({
      template: serverTemplate,
      updatedAt: VERSION,
    } as never);
  });

  it("blocks saving, hides Save and offers reload after a 409", async () => {
    vi.mocked(saveDocumentTemplateServer).mockRejectedValueOnce(conflictError);
    const container = await renderEditor();

    await vi.waitFor(() => expect(captured?.template.elements[0]?.label).toBe("SERVER"));

    await act(async () => {
      await expect(captured!.onSave(serverTemplate)).rejects.toThrow(
        "Template save failure already reported",
      );
    });

    expect(notify.error).toHaveBeenCalledWith("templateEditor.saveConflict");
    expect(captured?.canSave).toBe(false);
    expect(container.textContent).toContain("templateEditor.saveConflict");
    expect(container.textContent).toContain("templateEditor.reloadLatest");
  });

  it("reloads the latest layout and unblocks saving", async () => {
    vi.mocked(saveDocumentTemplateServer).mockRejectedValueOnce(conflictError);
    const container = await renderEditor();
    await vi.waitFor(() => expect(captured?.template.elements[0]?.label).toBe("SERVER"));

    await act(async () => {
      await expect(captured!.onSave(serverTemplate)).rejects.toThrow();
    });

    vi.mocked(fetchDocumentTemplateServer).mockResolvedValue({
      template: latestTemplate,
      updatedAt: "2026-01-02T00:00:00.000Z",
    } as never);

    const reloadButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("templateEditor.reloadLatest"),
    );
    expect(reloadButton).toBeTruthy();

    await act(async () => {
      reloadButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => expect(captured?.template.elements[0]?.label).toBe("LATEST"));
    expect(captured?.canSave).toBe(true);
    expect(container.textContent).not.toContain("templateEditor.reloadLatest");
  });
});
