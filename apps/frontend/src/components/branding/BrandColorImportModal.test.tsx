import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrandColorImportModal, parseImportCandidate } from "./BrandColorImportModal";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("BrandColorImportModal & parseImportCandidate", () => {
  describe("parseImportCandidate", () => {
    it("returns null for empty or whitespace-only input", () => {
      expect(parseImportCandidate("")).toBeNull();
      expect(parseImportCandidate("   \n  \t ")).toBeNull();
    });

    it("parses valid JSON with primary and accent/secondary", () => {
      const jsonAccent = JSON.stringify({ primary: "#1e40af", accent: "#047857" });
      expect(parseImportCandidate(jsonAccent)).toEqual({
        primary: "#1e40af",
        secondary: "#047857",
      });

      const jsonSecondary = JSON.stringify({ primary: "#111827", secondary: "#4f46e5" });
      expect(parseImportCandidate(jsonSecondary)).toEqual({
        primary: "#111827",
        secondary: "#4f46e5",
      });
    });

    it("parses comma or space separated hex values", () => {
      const commaSep = "#2563eb, #10b981";
      expect(parseImportCandidate(commaSep)).toEqual({
        primary: "#2563eb",
        secondary: "#10b981",
      });

      const spaceSep = "#2563eb #10b981";
      expect(parseImportCandidate(spaceSep)).toEqual({
        primary: "#2563eb",
        secondary: "#10b981",
      });
    });

    it("returns null for invalid color formats or malformed JSON", () => {
      expect(parseImportCandidate("not-a-color")).toBeNull();
      expect(parseImportCandidate("{ broken json ")).toBeNull();
      expect(parseImportCandidate("#123456")).toBeNull(); // Missing second color
    });
  });

  describe("BrandColorImportModal component", () => {
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

    it("renders modal when open and handles text input and confirmation", async () => {
      const onImport = vi.fn();
      const onClose = vi.fn();

      await act(async () => {
        root.render(<BrandColorImportModal open={true} onClose={onClose} onImport={onImport} />);
      });

      const textarea = document.querySelector("#import-palette-input") as HTMLTextAreaElement;
      expect(textarea).not.toBeNull();

      // Enter valid colors
      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        nativeSetter?.call(textarea, "#1d4ed8, #059669");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.dispatchEvent(new Event("change", { bubbles: true }));
      });

      // Confirm button should be enabled
      const buttons = Array.from(document.querySelectorAll("button"));
      const importBtn = buttons.find((btn) =>
        btn.textContent?.includes("theme.importPaletteAction"),
      );
      expect(importBtn).not.toBeNull();
      expect(importBtn?.disabled).toBe(false);

      // Click confirm import
      await act(async () => {
        importBtn?.click();
      });

      expect(onImport).toHaveBeenCalledWith("#1d4ed8", "#059669");
    });

    it("displays error message for invalid color text and handles close", async () => {
      const onImport = vi.fn();
      const onClose = vi.fn();

      await act(async () => {
        root.render(<BrandColorImportModal open={true} onClose={onClose} onImport={onImport} />);
      });

      const textarea = document.querySelector("#import-palette-input") as HTMLTextAreaElement;
      expect(textarea).not.toBeNull();

      // Enter invalid text
      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        nativeSetter?.call(textarea, "invalid text");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      });

      expect(document.body.textContent).toContain("theme.pastePaletteInvalid");

      // Cancel button triggers onClose
      const buttons = Array.from(document.querySelectorAll("button"));
      const cancelBtn = buttons.find((btn) => btn.textContent?.includes("common.cancel"));
      expect(cancelBtn).not.toBeNull();

      await act(async () => {
        cancelBtn?.click();
      });

      expect(onClose).toHaveBeenCalled();
    });
  });
});
