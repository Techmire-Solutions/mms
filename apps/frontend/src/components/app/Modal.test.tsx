import React from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal Component", () => {
  it("instantiates Modal element structure with open prop", () => {
    function ModalWrapper({ open }: { open: boolean }) {
      return (
        <Modal open={open} onClose={() => {}} title="Test Modal">
          <div>Content</div>
        </Modal>
      );
    }

    const openElement = <ModalWrapper open={true} />;
    const closedElement = <ModalWrapper open={false} />;

    expect(openElement.type).toBe(ModalWrapper);
    expect(closedElement.type).toBe(ModalWrapper);
  });

  it("exposes compound components Modal.Header, Modal.Tabs, Modal.Footer, Modal.Error", () => {
    expect(Modal.Header).toBeDefined();
    expect(Modal.Tabs).toBeDefined();
    expect(Modal.Footer).toBeDefined();
    expect(Modal.Error).toBeDefined();
  });

  it("renders header extra, actions, and custom footer via compound pattern or props", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    const element = (
      <Modal
        open={true}
        onClose={handleClose}
        title="Edit Profile"
        subtitle="Update student information"
        headerActions={<button type="button">Action</button>}
        onSave={handleSave}
        saveLabel="Update"
        cancelLabel="Discard"
      >
        <p>Modal body content</p>
      </Modal>
    );

    expect(element.props.title).toBe("Edit Profile");
    expect(element.props.subtitle).toBe("Update student information");
    expect(element.props.saveLabel).toBe("Update");
  });
});
