import React, { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DashedFileDropZone } from "./DashedFileDropZone";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("DashedFileDropZone", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders with browseLabel and handles drag events, browse click, and file drop", async () => {
    const onDraggingChange = vi.fn();
    const onFiles = vi.fn();
    const onOpenPicker = vi.fn();

    await act(async () => {
      root.render(
        <DashedFileDropZone
          isDragging={false}
          onDraggingChange={onDraggingChange}
          onFiles={onFiles}
          title="Upload Documents"
          description="Drag and drop or browse"
          inputAriaLabel="Attach file"
          browseLabel="Select Document"
          onOpenPicker={onOpenPicker}
        />,
      );
    });

    expect(container.textContent).toContain("Upload Documents");
    expect(container.textContent).toContain("Drag and drop or browse");
    expect(container.textContent).toContain("Select Document");

    const dropzone = container.querySelector('[role="presentation"]') as HTMLElement;
    expect(dropzone).not.toBeNull();

    // Drag over
    await act(async () => {
      dropzone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    });
    expect(onDraggingChange).toHaveBeenCalledWith(true);

    // Drag leave
    await act(async () => {
      dropzone.dispatchEvent(new Event("dragleave", { bubbles: true, cancelable: true }));
    });
    expect(onDraggingChange).toHaveBeenCalledWith(false);

    // Drop
    const file = new File(["dummy content"], "test.csv", { type: "text/csv" });
    const dropEvent = new Event("drop", { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { files: [file] },
    });
    await act(async () => {
      dropzone.dispatchEvent(dropEvent);
    });
    expect(onFiles).toHaveBeenCalled();

    // Click browse button
    const browseBtn = container.querySelector("button") as HTMLButtonElement;
    expect(browseBtn).not.toBeNull();
    await act(async () => {
      browseBtn.click();
    });
    expect(onOpenPicker).toHaveBeenCalled();
  });

  it("renders minimal button variant and handles file input click and change", async () => {
    const onDraggingChange = vi.fn();
    const onFiles = vi.fn();
    const inputRef = createRef<HTMLInputElement>();

    await act(async () => {
      root.render(
        <DashedFileDropZone
          isDragging={true}
          onDraggingChange={onDraggingChange}
          onFiles={onFiles}
          title="Upload Photo"
          description="Click to upload"
          inputAriaLabel="Choose image"
          inputId="photo-input"
          inputName="photo"
          fileInputRef={inputRef}
        />,
      );
    });

    const fileInput = container.querySelector("input#photo-input") as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File(["dummy"], "avatar.png", { type: "image/png" });
    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [file],
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onFiles).toHaveBeenCalled();
  });

  it("names the dropzone with its visible copy (WCAG 2.5.3 label in name)", async () => {
    await act(async () => {
      root.render(
        <DashedFileDropZone
          isDragging={false}
          onDraggingChange={vi.fn()}
          onFiles={vi.fn()}
          title="Drop CSV file here"
          description="or click to browse from your device (.csv format)"
          inputAriaLabel="Upload CSV file"
          inputId="csv-input"
          inputName="file"
        />,
      );
    });

    const zone = container.querySelector("button") as HTMLButtonElement;
    const accessibleName = zone.getAttribute("aria-label") ?? "";
    // The rendered review flagged a serious label-content-name-mismatch because the
    // zone said "Upload CSV file" while its visible text said "Drop CSV file here".
    expect(accessibleName).toContain("Drop CSV file here");
    expect(accessibleName).toContain("or click to browse from your device (.csv format)");

    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("Upload CSV file");
  });

  it("names the browse control with its visible label", async () => {
    await act(async () => {
      root.render(
        <DashedFileDropZone
          isDragging={false}
          onDraggingChange={vi.fn()}
          onFiles={vi.fn()}
          title="Upload Documents"
          description="Drag and drop or browse"
          inputAriaLabel="Attach file"
          browseLabel="Select Document"
          onOpenPicker={vi.fn()}
        />,
      );
    });

    const browseButton = container.querySelector("button") as HTMLButtonElement;
    expect(browseButton.getAttribute("aria-label")).toBe("Select Document");
  });

  it("respects disabled and isUploading state", async () => {
    const onDraggingChange = vi.fn();
    const onFiles = vi.fn();
    const onOpenPicker = vi.fn();

    await act(async () => {
      root.render(
        <DashedFileDropZone
          isDragging={false}
          onDraggingChange={onDraggingChange}
          onFiles={onFiles}
          title="Upload Disabled"
          description="Cannot upload"
          inputAriaLabel="Disabled picker"
          browseLabel="Upload"
          disabled={true}
          onOpenPicker={onOpenPicker}
        />,
      );
    });

    const dropzone = container.querySelector('[role="presentation"]') as HTMLElement;
    await act(async () => {
      dropzone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    });
    expect(onDraggingChange).not.toHaveBeenCalled();

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
