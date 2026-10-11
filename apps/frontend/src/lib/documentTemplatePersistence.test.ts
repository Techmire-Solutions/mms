import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentTemplate } from "@mms/shared";
import { createDocumentTemplateStore } from "./documentTemplatePersistence";

type Payload = { title: string };

const store = createDocumentTemplateStore<Payload>({
  key: "test_document_template",
  changedEvent: "mms:test-document-template-changed",
  documentName: "test",
});

const fallback: DocumentTemplate<Payload> = {
  pageSize: "A6",
  elements: [{ id: "t", type: "text", label: "Title", x: 0, y: 0, w: 10, h: 10, field: "title" }],
};

describe("createDocumentTemplateStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
  });

  it("given empty storage, should return the fallback when loading", () => {
    // Act
    const loaded = store.load(fallback);

    // Assert
    expect(loaded).toBe(fallback);
  });

  it("given a stored value that fails the schema, should return the fallback when loading", () => {
    // Arrange
    localStorage.setItem(store.key, JSON.stringify({ pageSize: "A6", elements: [{ id: 1 }] }));

    // Act
    const loaded = store.load(fallback);

    // Assert
    expect(loaded).toBe(fallback);
  });

  it("given a valid template, should persist it and broadcast the change event when saving", () => {
    // Arrange
    const listener = vi.fn();
    window.addEventListener(store.changedEvent, listener);
    const saved = { ...fallback, pageSize: "A5" };

    // Act
    store.save(saved);
    window.removeEventListener(store.changedEvent, listener);

    // Assert
    expect(store.load(fallback)).toEqual(saved);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("given an invalid template, should throw and leave storage untouched when saving", () => {
    // Act / Assert
    expect(() => store.save({ elements: [] } as unknown as DocumentTemplate<Payload>)).toThrow(
      "Cannot save invalid test template",
    );
    expect(store.load(fallback)).toBe(fallback);
  });
});
