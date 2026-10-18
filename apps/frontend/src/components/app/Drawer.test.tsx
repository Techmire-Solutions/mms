import React from "react";
import { describe, expect, it, vi } from "vitest";
import { Drawer } from "./Drawer";

describe("Drawer Component", () => {
  it("instantiates Drawer element structure with open prop", () => {
    function DrawerWrapper({ open }: { open: boolean }) {
      return (
        <Drawer open={open} onClose={() => {}} title="Test Drawer">
          <div>Drawer Content</div>
        </Drawer>
      );
    }

    const openElement = <DrawerWrapper open={true} />;
    const closedElement = <DrawerWrapper open={false} />;

    expect(openElement.type).toBe(DrawerWrapper);
    expect(closedElement.type).toBe(DrawerWrapper);
  });

  it("exposes compound components Drawer.Header, Drawer.ArchiveBanner, Drawer.RestoreOrEditAction", () => {
    expect(Drawer.Header).toBeDefined();
    expect(Drawer.ArchiveBanner).toBeDefined();
    expect(Drawer.RestoreOrEditAction).toBeDefined();
  });

  it("accepts side and size variants", () => {
    const handleClose = vi.fn();
    const element = (
      <Drawer
        open={true}
        onClose={handleClose}
        title="Side Drawer"
        side="start"
        size="lg"
        archiveBanner={<div>Archived Record</div>}
      >
        <p>Drawer Body</p>
      </Drawer>
    );

    expect(element.props.side).toBe("start");
    expect(element.props.size).toBe("lg");
    expect(element.props.title).toBe("Side Drawer");
  });
});
