import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notify } from "@mms/fe-core/notify";
import { useMessagingTemplateEditor } from "./useMessagingTemplateEditor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const saveTemplate = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@mms/fe-core/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("./useMessaging", () => ({
  useMessagingMutations: () => ({ saveTemplate: { mutateAsync: saveTemplate, isPending: false } }),
}));

type Editor = ReturnType<typeof useMessagingTemplateEditor>;

describe("useMessagingTemplateEditor", () => {
  let container: HTMLDivElement;
  let root: Root;
  let editor: Editor;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    saveTemplate.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderEditor(): Promise<void> {
    function Probe(): null {
      editor = useMessagingTemplateEditor();
      return null;
    }
    await act(async () => root.render(<Probe />));
  }

  it("creates, edits, validates unknown tokens, and resets a template", async () => {
    await renderEditor();
    await act(async () => editor.openCreate());
    expect(editor.saveDisabled).toBe(true);

    await act(async () => {
      editor.handleLabelChange("Fee reminder");
      editor.handleBodyChange("Assalamu Alaikum {name}, your fee is due.");
    });
    expect(editor.saveDisabled).toBe(false);

    await act(async () => editor.save());
    expect(saveTemplate).toHaveBeenCalledTimes(1);
    expect(saveTemplate.mock.calls[0]?.[0]).toMatchObject({
      body: { label: "Fee reminder", body: "Assalamu Alaikum {name}, your fee is due." },
    });

    await act(async () => {
      editor.handleEdit({
        id: "tpl-1",
        label: "Existing",
        body: "Existing body",
        category: "general",
        channel: "all",
      });
    });
    expect(editor.editingId).toBe("tpl-1");
    expect(editor.label).toBe("Existing");
    expect(editor.body).toBe("Existing body");

    await act(async () => editor.handleBodyChange("Hello {unknown_token}"));
    expect(editor.saveDisabled).toBe(true);

    await act(async () => editor.resetForm());
    expect(editor.editingId).toBeNull();
    expect(editor.label).toBe("");
    expect(editor.body).toBe("");
  });

  it("clears the unknown-token error once the user edits the body", async () => {
    await renderEditor();
    await act(async () => {
      editor.openCreate();
      editor.handleLabelChange("Valid");
      editor.handleBodyChange("Hello {unknown_token}");
    });
    await act(async () => editor.syncBodyTokenErrorOnBlur());
    expect(editor.errors.body).toBe("messaging.unknownTokens");

    await act(async () => editor.handleBodyChange("Hello {name}, welcome."));
    expect(editor.errors.body).toBeUndefined();
  });

  it("survives a clipboard failure without an unhandled rejection", async () => {
    await renderEditor();
    const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await act(async () => editor.handleCopy("Template body"));
    expect(writeText).toHaveBeenCalledWith("Template body");
    expect(vi.mocked(notify.success)).not.toHaveBeenCalled();
  });
});
