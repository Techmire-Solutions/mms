import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageSquareOff } from "lucide-react";
import { ModuleWorkDirectoryEmpty } from "./ModuleWorkDirectoryEmpty";

describe("ModuleWorkDirectoryEmpty", () => {
  it("renders clear filters button when hasActiveFilters is true", () => {
    const html = renderToStaticMarkup(
      <ModuleWorkDirectoryEmpty
        icon={MessageSquareOff}
        title="No matching logs"
        description="Try adjusting filters"
        hasActiveFilters={true}
        viewingDeleted={false}
        onClearFilters={vi.fn()}
        clearFiltersLabel="Clear All Filters"
        showActiveLabel="Show Active"
      />,
    );

    expect(html).toContain("No matching logs");
    expect(html).toContain("Clear All Filters");
  });

  it("renders firstRunAction when hasActiveFilters is false and viewingDeleted is false", () => {
    const html = renderToStaticMarkup(
      <ModuleWorkDirectoryEmpty
        icon={MessageSquareOff}
        title="No messages sent yet"
        description="Get started by composing a message"
        hasActiveFilters={false}
        viewingDeleted={false}
        onClearFilters={vi.fn()}
        clearFiltersLabel="Clear All Filters"
        showActiveLabel="Show Active"
        firstRunAction={<button data-testid="first-run-btn">Compose First Message</button>}
      />,
    );

    expect(html).toContain("No messages sent yet");
    expect(html).toContain("Compose First Message");
  });
});
