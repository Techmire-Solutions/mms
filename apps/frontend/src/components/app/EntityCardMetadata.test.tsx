import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EntityCardMetadata, resolveFieldLabel } from "@/components/app/EntityCardMetadata";
import { createEntityDescriptor } from "@/components/common/entityRegistry";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => `t:${key}`, dir: "ltr", language: "en" }),
}));

const descriptor = createEntityDescriptor<{ id: string; city: string }>({
  entityType: "demo",
  singularLabel: "Demo",
  pluralLabel: "Demos",
  idField: "id",
  titleField: "id",
  fields: [
    { key: "city", label: "Fallback City", labelKey: "demo.city", type: "text", cardSlot: "meta" },
  ],
});

describe("EntityCardMetadata descriptor labels", () => {
  it("resolveFieldLabel prefers labelKey via t, falls back to label", () => {
    expect(resolveFieldLabel({ label: "L", labelKey: "k.demo" }, (k: string) => `t:${k}`)).toBe(
      "t:k.demo",
    );
    expect(resolveFieldLabel({ label: "L" }, (k: string) => `t:${k}`)).toBe("L");
  });

  it("renders descriptor tiles with translated labelKey labels", () => {
    const html = renderToStaticMarkup(
      <EntityCardMetadata descriptor={descriptor} entity={{ id: "1", city: "Lahore" }} />,
    );
    expect(html).toContain("t:demo.city");
    expect(html).toContain("Lahore");
  });
});

describe("EntityCardMetadata merge mode", () => {
  it("renders descriptor tiles and legacy columns, deduped by key", () => {
    const html = renderToStaticMarkup(
      <EntityCardMetadata
        descriptor={descriptor}
        entity={{ id: "1", city: "Lahore" }}
        extraColumns={{
          columns: [
            { label: "x", id: "city" },
            { label: "y", id: "notes" },
          ],
          keyFor: (col) => col.id,
          labelFor: (col) => (col.id === "notes" ? "Notes" : col.label),
          renderValue: (col) => (col.id === "notes" ? "hello notes" : null),
        }}
      />,
    );
    expect(html).toContain("Lahore"); // descriptor tile kept
    expect(html).not.toContain("Fallback City"); // legacy "city" deduped (descriptor won)
    expect(html).toContain("Notes");
    expect(html).toContain("hello notes");
  });
});
