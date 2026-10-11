import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Plus } from "lucide-react";
import { FormListFieldCard } from "@/components/ui/FormPrimitives";
import { ContactSubListShell, resolveSubListAllowAdd } from "./ContactSubListCards";

vi.mock("@/components/ui/EmptyState", () => ({
  EmptyState: ({ title, action }: { title: string; action?: React.ReactNode }) => (
    <div>
      <p>{title}</p>
      {action}
    </div>
  ),
}));

describe("ContactSubListCards Components", () => {
  it("resolveSubListAllowAdd calculates allowAdd correctly", () => {
    expect(resolveSubListAllowAdd([false, false], 0)).toBe(false);
    expect(resolveSubListAllowAdd([false, true], 0)).toBe(true);
    expect(resolveSubListAllowAdd([false, false], 1)).toBe(true);
  });

  it("renders FormListFieldCard with typeSelect chrome", () => {
    const html = renderToStaticMarkup(
      <FormListFieldCard
        id="card-1"
        index={0}
        label={undefined}
        typeSelect={<span>Type control</span>}
        onRemove={vi.fn()}
        removeLabel="Remove item"
      >
        <div>Content</div>
      </FormListFieldCard>,
    );

    expect(html).toContain("Type control");
    expect(html).toContain("Content");
    expect(html).toContain("Remove item");
  });

  it("renders ContactSubListShell when empty with shared add-another control", () => {
    const html = renderToStaticMarkup(
      <ContactSubListShell
        isEmpty={true}
        emptyIcon={Plus}
        emptyMessage="No items yet"
        addLabel="Phone Number"
        onAdd={vi.fn()}
        onEnsureRow={vi.fn()}
      >
        <div>Children</div>
      </ContactSubListShell>,
    );

    expect(html).toContain("No items yet");
    expect(html).toContain("Phone Number");
    expect(html).toContain('type="button"');
  });
});
