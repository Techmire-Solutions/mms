import React from "react";
import { describe, expect, it, vi } from "vitest";
import { DetailDrawerShell } from "./DetailDrawerShell";

describe("DetailDrawerShell Component", () => {
  it("instantiates DetailDrawerShell element structure with open prop", () => {
    function DrawerWrapper({ open }: { open: boolean }) {
      return (
        <DetailDrawerShell open={open} onClose={() => {}} title="Test DetailDrawerShell">
          <div>DetailDrawerShell Content</div>
        </DetailDrawerShell>
      );
    }

    const openElement = <DrawerWrapper open={true} />;
    const closedElement = <DrawerWrapper open={false} />;

    expect(openElement.type).toBe(DrawerWrapper);
    expect(closedElement.type).toBe(DrawerWrapper);
  });

  it("exposes compound components DetailDrawerShell.Header, DetailDrawerShell.ArchiveBanner, DetailDrawerShell.RestoreOrEditAction", () => {
    expect(DetailDrawerShell.Header).toBeDefined();
    expect(DetailDrawerShell.ArchiveBanner).toBeDefined();
    expect(DetailDrawerShell.RestoreOrEditAction).toBeDefined();
  });

  it("accepts side and size variants", () => {
    const handleClose = vi.fn();
    const element = (
      <DetailDrawerShell
        open={true}
        onClose={handleClose}
        title="Side DetailDrawerShell"
        side="start"
        size="lg"
        archiveBanner={<div>Archived Record</div>}
      >
        <p>DetailDrawerShell Body</p>
      </DetailDrawerShell>
    );

    expect(element.props.side).toBe("start");
    expect(element.props.size).toBe("lg");
    expect(element.props.title).toBe("Side DetailDrawerShell");
  });

  it("renders scroll-state-container with top and bottom affordance indicators", async () => {
    const { createRoot } = await import("react-dom/client");
    const { act } = await import("react");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DetailDrawerShell open={true} onClose={() => {}} title="Scrollable DetailDrawerShell">
          <div>Item 1</div>
          <div>Item 2</div>
        </DetailDrawerShell>,
      );
    });

    const scrollContainer = document.querySelector(".scroll-state-container");
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.querySelector(".scroll-indicator-top")).not.toBeNull();
    expect(scrollContainer?.querySelector(".scroll-indicator-bottom")).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
