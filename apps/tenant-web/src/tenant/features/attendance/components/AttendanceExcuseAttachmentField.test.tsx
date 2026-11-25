import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceExcuseAttachmentField } from "./AttendanceExcuseAttachmentField";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("AttendanceExcuseAttachmentField", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("locks add/remove while uploading and clears the picker after selection", async () => {
    const onUpload = vi.fn();
    await act(async () => {
      root.render(
        <AttendanceExcuseAttachmentField
          documentRef="tenants/demo/file.pdf"
          uploading
          onUpload={onUpload}
          onRemove={vi.fn()}
        />,
      );
    });
    const input = document.body.querySelector("#attendance-excuse-file") as HTMLInputElement;
    const buttons = [...document.querySelectorAll("button")];
    expect(input.disabled).toBe(true);
    expect(
      buttons.find((button) => button.textContent?.includes("attendance.excuses.removeAttachment"))
        ?.disabled,
    ).toBe(true);

    await act(async () => {
      root.render(
        <AttendanceExcuseAttachmentField
          documentRef={null}
          uploading={false}
          onUpload={onUpload}
          onRemove={vi.fn()}
        />,
      );
    });
    const file = new File(["cert"], "cert.pdf", { type: "application/pdf" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onUpload).toHaveBeenCalledWith(file);
    expect(input.value).toBe("");
  });
});
