import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleWorkTableHeader } from "@mms/fe-core/components/ModuleWorkTableHeader";

describe("ModuleWorkTableHeader", () => {
  const columns = [
    { id: "name", label: "Name" },
    { id: "gender", label: "Gender" },
    { id: "phone", label: "Phone" },
  ];

  it("renders columns and sticky classes without selection", () => {
    const html = renderToStaticMarkup(
      <table>
        <ModuleWorkTableHeader
          columns={columns}
          getColumnWidth={() => 120}
          setColumnWidth={vi.fn()}
          stickyColumnIds={["name"]}
          stickyLeftOffsets={{ name: 0 }}
          actionsLabel="Actions"
        />
      </table>,
    );

    expect(html).toContain("Name");
    expect(html).toContain("Gender");
    expect(html).toContain("Phone");
    expect(html).toContain("Actions");
    expect(html).toContain("inset-inline-start:0");
  });

  it("renders selection checkbox and offsets sticky column with start-12", () => {
    const onSelectAll = vi.fn();
    const html = renderToStaticMarkup(
      <table>
        <ModuleWorkTableHeader
          columns={columns}
          getColumnWidth={() => 120}
          setColumnWidth={vi.fn()}
          stickyColumnIds={["name"]}
          stickyLeftOffsets={{ name: 48 }}
          selection={{
            allSelected: false,
            someSelected: true,
            onSelectAll,
            ariaLabel: "Select all",
          }}
        />
      </table>,
    );

    expect(html).toContain("inset-inline-start:48px");
    expect(html).toContain('aria-label="Select all"');
  });

  it("triggers selection when clicking selection header cell", () => {
    const onSelectAll = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <table>
          <ModuleWorkTableHeader
            columns={columns}
            getColumnWidth={() => 120}
            setColumnWidth={vi.fn()}
            selection={{
              allSelected: false,
              someSelected: false,
              onSelectAll,
              ariaLabel: "Select all",
            }}
          />
        </table>,
      );
    });

    const selectTh = container.querySelector("th.cursor-pointer") as HTMLElement;
    expect(selectTh).toBeTruthy();
    act(() => {
      selectTh.click();
    });
    expect(onSelectAll).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
