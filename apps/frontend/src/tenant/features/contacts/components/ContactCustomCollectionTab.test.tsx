import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { FieldDefinition } from "@mms/shared";
import { ContactCustomCollectionTab } from "./ContactCustomCollectionTab";

const fields: FieldDefinition[] = [
  {
    key: "hobbyName",
    label: "Hobby",
    type: "text",
    enabled: true,
    order: 1,
    required: true,
  },
];

function makeDraft(rows: Record<string, unknown>[]) {
  return {
    contactDraft: { hobbies: rows },
    fields: { hobbies: fields },
    getListItemError: () => undefined,
    updateDraft: vi.fn(),
  };
}

describe("ContactCustomCollectionTab", () => {
  it("renders registry fields and appends a stable row", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const draft = makeDraft([{ hobbyName: "Reading" }]);

    await act(async () => {
      root.render(
        <ContactCustomCollectionTab
          tabId="hobbies"
          draft={draft as unknown as Parameters<typeof ContactCustomCollectionTab>[0]["draft"]}
        />,
      );
    });

    const input = container.querySelector<HTMLInputElement>("input");
    expect(input?.value).toBe("Reading");

    const add = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("common.add"),
    );
    await act(async () => add?.click());
    expect(draft.updateDraft).toHaveBeenCalledWith({ hobbies: [{ hobbyName: "Reading" }, {}] });

    await act(async () => root.unmount());
    container.remove();
  });
});
