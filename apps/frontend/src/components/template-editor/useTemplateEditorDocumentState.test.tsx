import React, { act, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { DocumentTemplate } from "@mms/shared";
import { useTemplateEditorDocumentState } from "./useTemplateEditorDocumentState";
import { notify } from "@/lib/notify";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Payload {
  title: string;
}

const template: DocumentTemplate<Payload> = {
  pageSize: "A5",
  elements: [{ id: "el_1", type: "static", label: "Invoice Title", x: 10, y: 10, w: 100, h: 20 }],
};

const t = ((key: string) => key) as unknown as TranslationFunction;

let container: HTMLDivElement;
let root: Root;
let currentDoc!: ReturnType<typeof useTemplateEditorDocumentState<Payload>>;

async function mountDoc(
  onSave?: (next: DocumentTemplate<Payload>) => void | Promise<void>,
  options: { strict?: boolean } = {},
): Promise<void> {
  function Probe() {
    currentDoc = useTemplateEditorDocumentState<Payload>({
      initialTemplate: template,
      defaultTemplate: template,
      onSave,
      t,
    });
    return null;
  }

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const tree = <Probe />;
  await act(async () => {
    root.render(options.strict ? <StrictMode>{tree}</StrictMode> : tree);
  });
}

async function unmountDoc() {
  await act(async () => root.unmount());
  container.remove();
}

describe("useTemplateEditorDocumentState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (container?.isConnected) await unmountDoc();
  });

  it("reports a single save failure toast and keeps the document dirty", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("403"));
    await mountDoc(onSave);

    await act(async () => {
      currentDoc.commitUpdate((elements) =>
        elements.map((element) => ({ ...element, label: "Edited" })),
      );
    });

    await act(async () => {
      await currentDoc.handleSave();
    });

    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith("templateEditor.saveFailed");
    expect(currentDoc.isDirty).toBe(true);
    expect(currentDoc.saved).toBe(false);
  });

  it("marks the document clean after a successful save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await mountDoc(onSave);

    await act(async () => {
      await currentDoc.handleSave();
    });

    expect(currentDoc.isDirty).toBe(false);
    expect(currentDoc.saved).toBe(true);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("treats a burst of coalesced edits as one undo step", async () => {
    await mountDoc();

    await act(async () => {
      currentDoc.commitUpdateCoalesced("label", (elements) =>
        elements.map((element) => ({ ...element, label: "Invoice T" })),
      );
    });
    await act(async () => {
      currentDoc.commitUpdateCoalesced("label", (elements) =>
        elements.map((element) => ({ ...element, label: "Invoice Ti" })),
      );
    });

    expect(currentDoc.history).toHaveLength(1);

    await act(async () => currentDoc.undo());
    expect(currentDoc.template.elements[0]?.label).toBe("Invoice Title");
  });

  it("keeps one history entry per undo even under StrictMode", async () => {
    await mountDoc(undefined, { strict: true });

    await act(async () => {
      currentDoc.commitUpdate((elements) =>
        elements.map((element) => ({ ...element, label: "Changed" })),
      );
    });

    expect(currentDoc.history).toHaveLength(1);

    await act(async () => currentDoc.undo());
    expect(currentDoc.template.elements[0]?.label).toBe("Invoice Title");
    expect(currentDoc.future).toHaveLength(1);
  });

  it("discards the draft back to the last saved layout", async () => {
    await mountDoc();

    await act(async () => {
      currentDoc.commitUpdate((elements) =>
        elements.map((element) => ({ ...element, label: "Dirty" })),
      );
    });
    expect(currentDoc.isDirty).toBe(true);

    await act(async () => currentDoc.discardChanges());

    expect(currentDoc.template.elements[0]?.label).toBe("Invoice Title");
    expect(currentDoc.isDirty).toBe(false);
    expect(currentDoc.history).toHaveLength(0);
  });

  it("adopts a reloaded persisted layout only while the draft is pristine", async () => {
    let doc!: ReturnType<typeof useTemplateEditorDocumentState<Payload>>;
    let setInitial!: (next: DocumentTemplate<Payload>) => void;

    function Harness() {
      const [initial, setInitialState] = React.useState(template);
      setInitial = setInitialState;
      doc = useTemplateEditorDocumentState<Payload>({
        initialTemplate: initial,
        defaultTemplate: template,
        t,
      });
      return null;
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));

    await act(async () => {
      doc.commitUpdate((elements) =>
        elements.map((element) => ({ ...element, label: "Local edit" })),
      );
    });
    await act(async () => {
      setInitial({ ...template, pageSize: "A4" });
    });

    // Dirty draft wins: the late server layout must not overwrite the user's work.
    expect(doc.template.elements[0]?.label).toBe("Local edit");
    expect(doc.template.pageSize).toBe("A5");
  });

  it("adopts a reloaded persisted layout when nothing was edited", async () => {
    let doc!: ReturnType<typeof useTemplateEditorDocumentState<Payload>>;
    let setInitial!: (next: DocumentTemplate<Payload>) => void;

    function Harness() {
      const [initial, setInitialState] = React.useState(template);
      setInitial = setInitialState;
      doc = useTemplateEditorDocumentState<Payload>({
        initialTemplate: initial,
        defaultTemplate: template,
        t,
      });
      return null;
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));

    await act(async () => {
      setInitial({ ...template, pageSize: "A4" });
    });

    expect(doc.template.pageSize).toBe("A4");
    expect(doc.isDirty).toBe(false);
  });
});
