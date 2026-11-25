import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { Contact } from "@mms/contracts";
import { useContactFormSubLists } from "./useContactFormSubLists";

function Harness({
  initial,
  onIds,
}: {
  initial: Partial<Contact>;
  onIds: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState<Partial<Contact>>(initial);
  const api = useContactFormSubLists(draft, setDraft, "form-1");
  onIds([api.getLocalId("phones", 0), api.getLocalId("phones", 1)]);

  return (
    <div>
      <button type="button" onClick={() => api.removeSubListItem("phones", 0)}>
        remove-first
      </button>
      <button
        type="button"
        onClick={() => api.addSubListItem("phones", { number: "333", label: "Mobile" })}
      >
        add
      </button>
    </div>
  );
}

describe("useContactFormSubLists local ids", () => {
  it("keeps the remaining row's id when an earlier row is removed", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let ids: string[] = [];

    await act(async () => {
      root.render(
        <Harness
          initial={{
            phones: [
              { number: "111", label: "Mobile" },
              { number: "222", label: "Home" },
            ],
          }}
          onIds={(next) => (ids = next)}
        />,
      );
    });
    const [, secondId] = ids;
    expect(secondId).toMatch(/phones/);

    const remove = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "remove-first",
    );
    await act(async () => remove?.click());

    expect(ids[0]).toBe(secondId);

    await act(async () => root.unmount());
    container.remove();
  });

  it("mints a fresh id for an appended row", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let ids: string[] = [];

    await act(async () => {
      root.render(
        <Harness
          initial={{ phones: [{ number: "111", label: "Mobile" }] }}
          onIds={(next) => (ids = next)}
        />,
      );
    });
    const firstId = ids[0];

    const add = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "add",
    );
    await act(async () => add?.click());

    expect(ids[0]).toBe(firstId);
    expect(ids[1]).toMatch(/phones/);
    expect(ids[1]).not.toBe(firstId);

    await act(async () => root.unmount());
    container.remove();
  });
});
