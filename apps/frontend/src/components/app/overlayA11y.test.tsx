import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Modal } from "@/components/app/Modal";
import { FormModal } from "@/components/app/FormModal";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => `t:${key}`,
    dir: "ltr",
    language: "en",
    isRtl: false,
  }),
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => true, // Simulate desktop
}));

describe("Overlay Primitives Accessibility (WCAG 2.2 / WAI-ARIA)", () => {
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
    // Clean up any portaled elements in document.body
    document.querySelectorAll("[role='dialog']").forEach((el) => el.parentElement?.remove());
  });

  describe("Modal primitive", () => {
    it("renders role='dialog' with aria-modal='true' and linked aria-labelledby", async () => {
      await act(async () => {
        root.render(
          <Modal open={true} onClose={() => {}} title="Test Modal Title">
            <p>Modal Body</p>
          </Modal>,
        );
      });

      const dialog = document.querySelector("[role='dialog']");
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute("aria-modal")).toBe("true");

      const titleId = dialog?.getAttribute("aria-labelledby");
      expect(titleId).toBeTruthy();

      const titleElement = document.getElementById(titleId!);
      expect(titleElement).not.toBeNull();
      expect(titleElement?.textContent).toContain("Test Modal Title");
    });

    it("has a close button with an accessible label and min-h-11 touch target", async () => {
      await act(async () => {
        root.render(
          <Modal open={true} onClose={() => {}} title="Test Dialog">
            <button type="button">Focusable</button>
          </Modal>,
        );
      });

      const closeBtn = document.querySelector("button[aria-label='t:common.close']");
      expect(closeBtn).not.toBeNull();
      expect(closeBtn?.className).toContain("min-h-11");
      expect(closeBtn?.className).toContain("min-w-11");
    });
  });

  describe("FormModal primitive", () => {
    it("renders role='dialog' with aria-modal='true', cancel and save actions", async () => {
      const handleSave = vi.fn();
      const handleClose = vi.fn();

      await act(async () => {
        root.render(
          <FormModal
            open={true}
            onClose={handleClose}
            onSave={handleSave}
            title="Create Student Record"
            saveLabel="Submit"
            cancelLabel="Abort"
          >
            <input type="text" placeholder="Name" />
          </FormModal>,
        );
      });

      const dialog = document.querySelector("[role='dialog']");
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute("aria-modal")).toBe("true");

      // Verify buttons
      const saveBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Submit",
      );
      expect(saveBtn).toBeDefined();

      const cancelBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Abort",
      );
      expect(cancelBtn).toBeDefined();
    });
  });

  describe("FormModal keyboard submission", () => {
    it("submits a single-field form on Enter and ignores Enter in a textarea", async () => {
      const onSave = vi.fn();
      await act(async () => {
        root.render(
          <FormModal open={true} onClose={() => {}} onSave={onSave} title="Enter fallback">
            <input id="enter-name" aria-label="Name" />
            <textarea id="enter-notes" aria-label="Notes" />
          </FormModal>,
        );
      });

      await act(async () => {
        document
          .querySelector("#enter-notes")
          ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      });
      expect(onSave).not.toHaveBeenCalled();

      await act(async () => {
        document
          .querySelector("#enter-name")
          ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      });
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("wires a formId so Enter submission reaches the owning form", async () => {
      const onSave = vi.fn();
      await act(async () => {
        root.render(
          <FormModal
            open={true}
            onClose={() => {}}
            onSave={onSave}
            formId="enter-submit-form"
            title="Enter submit"
          >
            <form
              id="enter-submit-form"
              onSubmit={(event) => {
                event.preventDefault();
                onSave();
              }}
            >
              <input id="enter-submit-name" aria-label="Name" />
            </form>
          </FormModal>,
        );
      });

      const form = document.querySelector<HTMLFormElement>("#enter-submit-form");
      expect(form).not.toBeNull();
      await act(async () => {
        form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  describe("DetailDrawerShell primitive", () => {
    it("renders role='dialog' with aria-modal='true' and accessible titleId", async () => {
      await act(async () => {
        root.render(
          <DetailDrawerShell open={true} onClose={() => {}} title="Entity Detail View">
            <div>DetailDrawerShell Content</div>
          </DetailDrawerShell>,
        );
      });

      const drawer = document.querySelector("[role='dialog']");
      expect(drawer).not.toBeNull();
      expect(drawer?.getAttribute("aria-modal")).toBe("true");

      const titleId = drawer?.getAttribute("aria-labelledby");
      expect(titleId).toBeTruthy();

      const titleElement = document.getElementById(titleId!);
      expect(titleElement).not.toBeNull();
      expect(titleElement?.textContent).toContain("Entity Detail View");
    });
  });
});
